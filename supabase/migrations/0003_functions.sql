-- Expertly: all functions (and the grants tied to one of them). Trigger *attachments*
-- (`create trigger ... execute function ...`) live in 0004_tables.sql next to the table they
-- attach to — a trigger needs its table to already exist, but a function body does not need
-- the tables/types it references to exist yet at CREATE FUNCTION time, which is what makes this
-- functions-before-tables ordering possible. See 0001_extensions.sql's header for the four-file
-- split this belongs to.

-- Keep updated_at current on every row change, for every table that has one.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Every new auth.users row gets a matching profiles row. Always starts as 'client' — becoming a
-- 'member' only happens via an approved membership application (manual, admin-side); 'admin' is
-- set directly by a super-admin/migration, never self-service.
--
-- Fields filled here and why:
--   - email, first_name, last_name: from Supabase's own signup metadata. Reads both our own
--     signUp() keys (first_name/last_name) and the OIDC standard claim names LinkedIn's/Google's
--     integration actually populate (given_name/family_name), so every signup path works.
--   - role, status: left at their column defaults ('client'/'active') — every new signup starts
--     identical here regardless of path; nothing about signup itself justifies a different value.
--   - auth_provider: read from Supabase's own `raw_app_meta_data->>'provider'`, not guessed.
--     Matched against the known enum values explicitly (not a raw cast) so an unrecognized
--     provider value from Supabase can never raise an invalid-enum-input exception here and
--     roll back the whole signup — it just falls back to 'email'.
--   - last_login_at: set to signup time. There's no separate login-event tracking built yet, so
--     this is the first (and, until that's built, the only) truthful value for it — "created a
--     session" is what signing up actually did.
--   - consent: a hardcoded current terms/privacy version snapshot, same pattern as
--     membership_applications.terms_version_agreed/privacy_version_agreed — there's no real
--     versioning system yet, so '1.0'/'1.0' is the confirmed real current value, not a
--     placeholder. Bump both here (and reconsider this function) the day those documents change.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  provider public.auth_provider;
begin
  provider := case new.raw_app_meta_data ->> 'provider'
    when 'google' then 'google'
    when 'linkedin_oidc' then 'linkedin_oidc'
    else 'email'
  end;

  insert into public.profiles (
    id, email, first_name, last_name, auth_provider, last_login_at, consent
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'given_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data ->> 'family_name', ''),
    provider,
    now(),
    jsonb_build_object('termsVersion', '1.0', 'privacyVersion', '1.0', 'acceptedAt', now())
  );
  return new;
end;
$$;

-- Keep profiles.email in sync if a user changes their Supabase Auth login email.
create function public.handle_user_email_sync()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

-- Custom Access Token Hook: injects `app_role` into the JWT as a fast-path claim for the
-- NestJS backend. Created here but INERT until manually registered in the Supabase dashboard
-- under Authentication -> Hooks -> "Custom Access Token" — that registration step can't be
-- done via SQL/CLI.
create function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  claims jsonb;
  user_role text;
begin
  select role into user_role from public.profiles where id = (event ->> 'user_id')::uuid;
  claims := coalesce(event -> 'claims', '{}'::jsonb);
  claims := jsonb_set(claims, '{app_role}', to_jsonb(coalesce(user_role, 'client')));
  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

-- Hardening: the two auth.users trigger functions run SECURITY DEFINER and are only ever fired by
-- their triggers — nobody should be able to call them through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_sync() from public, anon, authenticated;

-- LANGUAGE sql function bodies are parsed — and their table references resolved — at CREATE time
-- unless this is off, and the search functions below read tables that 0004_tables.sql creates
-- later (plpgsql bodies, like every function above, are only checked when they run).
set check_function_bodies = off;

-- ============================================================================
-- AI search functions (tables, triggers and RLS: 0004_tables.sql "AI search").
-- All are callable by service_role only (grants at the end of this block); the NestJS `search`
-- module and worker (apps/backend/src/search/) are the only callers.
-- ============================================================================

-- The three-way search: meaning (halfvec cosine) + words (tsvector) + names (trigram),
-- merged with Reciprocal Rank Fusion (k = 60, name channel weight 0.7).
create or replace function public.search_hybrid(p_query text DEFAULT NULL::text, p_embedding text DEFAULT NULL::text, p_doc_types text[] DEFAULT NULL::text[], p_service_ids uuid[] DEFAULT NULL::uuid[], p_countries text[] DEFAULT NULL::text[], p_city text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_rate_max_cents integer DEFAULT NULL::integer, p_limit integer DEFAULT 10, p_min_similarity double precision DEFAULT 0)
 RETURNS TABLE(doc_type text, source_id uuid, title text, score double precision, vec_rank integer, kw_rank integer, name_rank integer, vec_sim double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  with params as (
    select nullif(btrim(p_query), '') as q,
           case when p_embedding is null then null else p_embedding::halfvec(768) end as emb,
           case when nullif(btrim(p_query), '') is null then null
                else replace(plainto_tsquery('english', btrim(p_query))::text, '&', '|')::tsquery end as tsq
  ),
  cand as not materialized (
    select d.*
      from public.search_documents d
     where (p_doc_types is null or d.doc_type = any(p_doc_types))
       and (p_service_ids is null or d.service_ids && p_service_ids)
       and (p_countries is null or d.countries && p_countries)
       and (p_city is null or d.city ilike p_city)
       and (p_date_from is null or d.doc_type <> 'event' or d.event_start >= p_date_from)
       and (p_date_to is null or d.doc_type <> 'event' or d.event_start <= p_date_to)
       and (p_rate_max_cents is null or d.doc_type <> 'member' or d.rate_min_cents <= p_rate_max_cents)
  ),
  vec as (
    select t.id, t.doc_type, t.sim, row_number() over (order by t.dist) as rn
      from (select c.id, c.doc_type, c.embedding <=> pr.emb as dist, 1 - (c.embedding <=> pr.emb) as sim
              from cand c cross join params pr
             where pr.emb is not null and c.embedding is not null
               and 1 - (c.embedding <=> pr.emb) >= p_min_similarity
             order by dist limit 50) t
  ),
  kw as (
    select t.id, t.doc_type, row_number() over (order by t.r desc) as rn
      from (select c.id, c.doc_type, ts_rank_cd(c.tsv, pr.tsq) as r
              from cand c cross join params pr
             where pr.tsq is not null and c.tsv @@ pr.tsq
             order by r desc limit 50) t
  ),
  nm as (
    select t.id, t.doc_type, row_number() over (order by t.s desc) as rn
      from (select c.id, c.doc_type, word_similarity(pr.q, c.search_name) as s
              from cand c cross join params pr
             where pr.q is not null and pr.q <% c.search_name
             order by s desc limit 50) t
  )
  select c.doc_type, c.source_id, c.title,
         (coalesce(1.0 / (60 + v.rn), 0) + coalesce(1.0 / (60 + k.rn), 0) + 0.7 * coalesce(1.0 / (60 + n.rn), 0))::double precision as score,
         v.rn::integer, k.rn::integer, n.rn::integer, v.sim::double precision
    from cand c
    cross join params pr
    left join vec v on v.id = c.id and v.doc_type = c.doc_type
    left join kw  k on k.id = c.id and k.doc_type = c.doc_type
    left join nm  n on n.id = c.id and n.doc_type = c.doc_type
   where (pr.q is null and pr.emb is null)
      or v.id is not null or k.id is not null or n.id is not null
   order by score desc, c.doc_date desc
   limit least(greatest(p_limit, 1), 100)
$function$;

-- Cards whose text changed since their embedding was made
create or replace function public.search_pending_embeddings(p_limit integer DEFAULT 50)
 RETURNS TABLE(id bigint, doc_type text, title text, content text, content_hash text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.id, d.doc_type, d.title, d.content, d.content_hash
    from public.search_documents d
   where d.embedded_hash is distinct from d.content_hash
   order by d.updated_at
   limit least(greatest(p_limit, 1), 200)
$function$;

-- Save an embedding only if the card text has not changed in the meantime
create or replace function public.search_store_embedding(p_id bigint, p_hash text, p_embedding text, p_model text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare n integer;
begin
  update public.search_documents
     set embedding = p_embedding::halfvec(768), embedding_model = p_model, embedded_hash = p_hash
   where id = p_id and content_hash = p_hash;   -- ignored if the content changed meanwhile
  get diagnostics n = row_count;
  return n = 1;
end $function$;

-- Practice-area phrase -> service ids
create or replace function public.search_match_services(p_text text, p_limit integer DEFAULT 8)
 RETURNS TABLE(service_id uuid, service_name text, category_name text, score real)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
AS $function$
  select t.service_id, t.service_name, t.category_name, t.score
  from (
    select s.id as service_id, s.name as service_name, c.name as category_name, s.sort_order,
           greatest(
             similarity(s.name, p_text),
             word_similarity(p_text, s.name),
             0.8 * similarity(c.name, p_text),
             case when s.name ilike '%' || p_text || '%' then 0.9 else 0 end
           )::real as score
      from public.services s
      join public.categories c on c.id = s.category_id
     where s.is_active and c.is_active and s.name not ilike 'other (please%'
  ) t
  where t.score >= 0.3
  order by t.score desc, t.sort_order
  limit least(greatest(p_limit, 1), 25)
$function$;

-- Trigger side: put a note in the outbox (one pending note per record). A duplicate note refreshes
-- enqueued_at so a change made while the record is being processed is not lost (see
-- search_outbox_complete).
create or replace function public.search_enqueue(p_type text, p_id uuid)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into public.search_outbox (doc_type, source_id) values (p_type, p_id)
  on conflict (doc_type, source_id) where processed_at is null
  do update set enqueued_at = clock_timestamp();
$function$;

create or replace function public.search_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
begin
  begin
    case tg_table_name
      when 'member_profiles' then
        if tg_op = 'DELETE' then
          delete from public.search_documents where doc_type = 'member' and source_id = old.profile_id;
        else
          perform public.search_enqueue('member', new.profile_id);
        end if;
      when 'profiles' then
        if exists (select 1 from public.member_profiles where profile_id = new.id) then
          perform public.search_enqueue('member', new.id);
        end if;
      when 'member_services' then
        perform public.search_enqueue('member', case when tg_op = 'DELETE' then old.member_id else new.member_id end);
      when 'articles' then
        if tg_op = 'DELETE' then
          delete from public.search_documents where doc_type = 'article' and source_id = old.id;
        else
          perform public.search_enqueue('article', new.id);
        end if;
      when 'events' then
        if tg_op = 'DELETE' then
          delete from public.search_documents where doc_type = 'event' and source_id = old.id;
        else
          perform public.search_enqueue('event', new.id);
        end if;
      when 'services' then
        -- a service was renamed: re-index every member and article that uses it
        insert into public.search_outbox (doc_type, source_id)
          select 'member', ms.member_id from public.member_services ms where ms.service_id = new.id
        on conflict (doc_type, source_id) where processed_at is null do nothing;
        insert into public.search_outbox (doc_type, source_id)
          select 'article', a.id from public.articles a where new.id = any(a.service_ids)
        on conflict (doc_type, source_id) where processed_at is null do nothing;
      else null;
    end case;
  exception when others then
    raise warning 'search queue failed (%): %', tg_table_name, sqlerrm;
  end;
  return null;
end $function$;

-- Outbox worker (apps/backend/src/search/outbox.service.ts). Claims up to p_limit pending notes
-- (FOR UPDATE SKIP LOCKED) by stamping claimed_at. PostgREST RPC calls are separate transactions,
-- so the stamp — not a row lock — is the claim. A claim older than p_lease is abandoned.
create or replace function public.search_outbox_claim(p_limit integer default 100, p_lease interval default '5 minutes')
 returns table(id bigint, doc_type text, source_id uuid, claimed_at timestamptz)
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.search_outbox o
     set claimed_at = clock_timestamp()
   where o.id in (
     select q.id from public.search_outbox q
      where q.processed_at is null
        and (q.claimed_at is null or q.claimed_at < now() - p_lease)
      order by q.id
      limit least(greatest(p_limit, 1), 500)
      for update skip locked)
  returning o.id, o.doc_type, o.source_id, o.claimed_at
$function$;

-- Finishes a claimed note. Success marks it done — unless the record was re-enqueued after the
-- claim, in which case it stays pending for another rebuild. Failure counts an attempt; the 5th
-- failure marks it failed. No-op if the claim was lost (lease expired and re-claimed).
create or replace function public.search_outbox_complete(p_id bigint, p_claimed_at timestamptz, p_error text default null)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.search_outbox o
     set processed_at = case
           when p_error is null then case when o.enqueued_at <= p_claimed_at then now() else null end
           when o.attempts + 1 >= 5 then now()
           else null end,
         failed     = (p_error is not null and o.attempts + 1 >= 5),
         attempts   = case when p_error is null then o.attempts else o.attempts + 1 end,
         last_error = case when p_error is null then o.last_error else left(p_error, 500) end,
         claimed_at = null
   where o.id = p_id and o.claimed_at = p_claimed_at
$function$;

revoke execute on function
  public.search_hybrid(text, text, text[], uuid[], text[], text, timestamptz, timestamptz, integer, integer, double precision),
  public.search_pending_embeddings(integer),
  public.search_store_embedding(bigint, text, text, text),
  public.search_match_services(text, integer),
  public.search_enqueue(text, uuid),
  public.search_outbox_claim(integer, interval),
  public.search_outbox_complete(bigint, timestamptz, text)
  from public, anon, authenticated;
grant execute on function
  public.search_hybrid(text, text, text[], uuid[], text[], text, timestamptz, timestamptz, integer, integer, double precision),
  public.search_pending_embeddings(integer),
  public.search_store_embedding(bigint, text, text, text),
  public.search_match_services(text, integer),
  public.search_enqueue(text, uuid),
  public.search_outbox_claim(integer, interval),
  public.search_outbox_complete(bigint, timestamptz, text)
  to service_role;
-- search_trg() is a trigger function: it fires for any role that edits the source tables
-- without needing EXECUTE.
revoke execute on function public.search_trg() from public, anon, authenticated;

reset check_function_bodies;
