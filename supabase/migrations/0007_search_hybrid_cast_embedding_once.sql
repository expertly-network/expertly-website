-- 0007: search_hybrid — convert the query embedding to halfvec ONCE per call, not once per row.
--
-- Why: in the vector channel, `p_embedding::halfvec(768)` is a text -> halfvec parse of 768 numbers.
-- Written inline (three times per row) inside a non-inlined function, Postgres evaluates it for every
-- candidate row, and the planner does not pick the HNSW index, so a single search cost 2.6–5.4 s on a
-- 6,000-card table and grew linearly with the card count. Wrapping each use in a scalar subquery,
-- `(select p_embedding::halfvec(768))`, turns it into an InitPlan: the parse runs once per call, and the
-- planner can still order by the HNSW index (`search_documents_emb_idx`) with that value as the
-- ordering key — measured on the same data: ~0.26 s for the vector channel with the index chosen, vs
-- ~2.6–4.7 s before. (Joining a params CTE instead, `cross join params pr ... pr.emb`, is fast on 6k
-- rows but forces an exact scan + sort over every card — the thing 0003's comment warns against —
-- so it is NOT used here.)
--
-- Results are identical: same expressions, same ranking, same filters, same RRF fusion. Only how often
-- the cast runs changes. Signature, return type, language, volatility, the SET options
-- (search_path, hnsw.ef_search, hnsw.iterative_scan) and the execute grants (service_role only, set in
-- 0003) are unchanged; `create or replace` keeps the existing privileges.
--
-- Safe on live data: a function body replacement only, no table or column touched. Idempotent
-- (re-running it is harmless). Apply on dev first, verify (see the checks at the bottom), then production.

begin;
set local lock_timeout = '5s';

create or replace function public.search_hybrid(p_query text DEFAULT NULL::text, p_embedding text DEFAULT NULL::text, p_doc_types text[] DEFAULT NULL::text[], p_service_ids uuid[] DEFAULT NULL::uuid[], p_countries text[] DEFAULT NULL::text[], p_city text DEFAULT NULL::text, p_date_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_date_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_rate_max_cents integer DEFAULT NULL::integer, p_limit integer DEFAULT 10, p_min_similarity double precision DEFAULT 0)
 RETURNS TABLE(doc_type text, source_id uuid, title text, score double precision, vec_rank integer, kw_rank integer, name_rank integer, vec_sim double precision)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'extensions'
 SET hnsw.ef_search TO '100'
 SET hnsw.iterative_scan TO 'relaxed_order'
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
      from (select c.id, c.doc_type,
                   c.embedding <=> (select p_embedding::halfvec(768)) as dist,
                   1 - (c.embedding <=> (select p_embedding::halfvec(768))) as sim
              from cand c
             where p_embedding is not null and c.embedding is not null
               and 1 - (c.embedding <=> (select p_embedding::halfvec(768))) >= p_min_similarity
             order by c.embedding <=> (select p_embedding::halfvec(768)) limit 50) t
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

commit;

notify pgrst, 'reload schema';

-- ── Checks after applying (run in the SQL editor; nothing here changes data) ──────────────────────
-- 1. Still service_role-only, config intact:
--      select proconfig, proacl from pg_proc where proname = 'search_hybrid';
--    expect search_path, hnsw.ef_search=100, hnsw.iterative_scan=relaxed_order; no anon/authenticated.
-- 2. Same results as before, and fast: ask the app a question and compare `ms`, or time the call:
--      explain (analyze, timing off, summary on)
--      select * from search_hybrid(p_query => 'family office GST VAT compliance',
--             p_embedding => (select embedding::text from search_documents where doc_type = 'member' limit 1),
--             p_doc_types => array['member','article','event'], p_limit => 20, p_min_similarity => 0.2);
--    expect "Execution Time" well under 1 s on ~6,000 cards (was 2.6–5.4 s).
