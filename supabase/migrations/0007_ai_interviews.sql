-- 0007 — AI interviewer (docs/superpowers/specs/2026-11-09-ai-interviewer-design.md §6).
-- Additive only: two new tables, one enum, one bucket, one trigger function, one email seed.
-- Idempotent: safe to re-run after a partial manual run.
begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'interview_status' and typnamespace = 'public'::regnamespace) then
    create type public.interview_status as enum (
      'ready', 'in_progress', 'interrupted', 'processing', 'completed', 'failed', 'voided'
    );
  end if;
end
$$;

create table if not exists public.member_interviews (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.member_profiles (profile_id) on delete cascade,
  status public.interview_status not null default 'ready',
  consent_version text not null,
  consent_at timestamptz not null,
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  reconnect_until timestamptz,
  ended_at timestamptz,
  -- AI-shaped documents, each carrying its own version, validated in code (interviews/brain/types.ts).
  plan jsonb,
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  state_version integer not null default 0,
  drafts jsonb,
  ledger jsonb,
  audio_opt_in boolean not null default false,
  verified_at timestamptz,
  llm_usage jsonb not null default '{}'::jsonb check (jsonb_typeof(llm_usage) = 'object'),
  -- Columns rather than JSONB: the search trigger and card builder read them.
  summary text check (summary is null or char_length(summary) <= 1500),
  summary_status text check (summary_status in ('pending', 'approved', 'hidden')),
  extract_attempts smallint not null default 0,
  extract_claimed_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The once-only rule: one non-voided interview per member. An admin "redo" voids the old one.
create unique index if not exists member_interviews_one_per_member
  on public.member_interviews (member_id) where status <> 'voided';
create index if not exists member_interviews_status_idx on public.member_interviews (status, updated_at desc);

-- One row per ElevenLabs conversation; a reconnect is a new row on the same interview.
create table if not exists public.member_interview_connections (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.member_interviews (id) on delete cascade,
  session_token_hash text not null unique,
  session_token_expires_at timestamptz not null,
  elevenlabs_conversation_id text unique,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  transcript jsonb check (transcript is null or jsonb_typeof(transcript) = 'array'),
  audio_path text,
  transcript_received_at timestamptz,
  audio_received_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists member_interview_connections_interview_idx
  on public.member_interview_connections (interview_id, started_at);

alter table public.member_interviews enable row level security;
alter table public.member_interview_connections enable row level security;

drop trigger if exists member_interviews_updated_at on public.member_interviews;
create trigger member_interviews_updated_at before update on public.member_interviews
  for each row execute function public.set_updated_at();

-- Search: re-enqueue the member's card when the approved summary changes. Separate from
-- search_trg() on purpose (spec §6.5) so the shared function stays untouched.
create or replace function public.interview_search_trg()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  begin
    perform public.search_enqueue('member', coalesce(new.member_id, old.member_id));
  exception when others then
    raise warning 'search queue failed (%): %', tg_table_name, sqlerrm;
  end;
  return null;
end;
$function$;
revoke execute on function public.interview_search_trg() from public, anon, authenticated;

drop trigger if exists interview_search_sync on public.member_interviews;
create trigger interview_search_sync after insert or delete or update of summary, summary_status, status
  on public.member_interviews for each row execute function public.interview_search_trg();

-- ---- v2 (2026-11-12): verification & sub-tags. Idempotent so re-running brings dev up to date.
alter table public.member_interviews
  add column if not exists ledger jsonb,
  add column if not exists audio_opt_in boolean not null default false,
  add column if not exists verified_at timestamptz,
  add column if not exists llm_usage jsonb not null default '{}'::jsonb;
alter table public.member_interviews drop column if exists assessment;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'facet_kind' and typnamespace = 'public'::regnamespace) then
    create type public.facet_kind as enum (
      'jurisdiction', 'instrument', 'work_type', 'forum', 'client_type', 'industry', 'scale', 'volume'
    );
  end if;
end
$$;

-- One row per scoring run; re-scoring adds a row and moves is_current.
create table if not exists public.interview_scorings (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.member_interviews (id) on delete cascade,
  rubric_version text not null,
  model text not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists interview_scorings_one_current
  on public.interview_scorings (interview_id) where is_current;

-- Sub-tag vocabulary. canonical values are attachable; candidates wait for 3 members or an admin.
create table if not exists public.facet_values (
  id uuid primary key default gen_random_uuid(),
  facet public.facet_kind not null,
  label text not null check (char_length(label) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status text not null default 'canonical' check (status in ('canonical', 'candidate', 'rejected')),
  aliases text[] not null default '{}',
  source_count integer not null default 0 check (source_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (facet, slug)
);
create index if not exists facet_values_status_idx on public.facet_values (status, facet);

-- Distinct members who produced a value (drives candidate → canonical at 3).
create table if not exists public.facet_value_sources (
  facet_value_id uuid not null references public.facet_values (id) on delete cascade,
  member_id uuid not null references public.member_profiles (profile_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (facet_value_id, member_id)
);

create table if not exists public.member_service_evidence (
  member_id uuid not null references public.member_profiles (profile_id) on delete cascade,
  service_id uuid not null references public.services (id),
  interview_id uuid not null references public.member_interviews (id) on delete cascade,
  scoring_id uuid not null references public.interview_scorings (id) on delete cascade,
  role smallint not null check (role between 0 and 5),
  evidence text not null check (evidence in ('E3', 'E2', 'E1', 'E0', 'EX', 'NP')),
  recency_year integer check (recency_year is null or recency_year between 1950 and 2100),
  evidence_summary text not null check (char_length(evidence_summary) between 1 and 400),
  status text not null default 'proposed'
    check (status in ('proposed', 'member_approved', 'active', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (member_id, service_id)
);
create index if not exists member_service_evidence_interview_idx on public.member_service_evidence (interview_id);

create table if not exists public.member_service_subtags (
  member_id uuid not null,
  service_id uuid not null,
  facet_value_id uuid not null references public.facet_values (id) on delete cascade,
  status text not null default 'proposed'
    check (status in ('proposed', 'member_approved', 'active', 'rejected')),
  created_at timestamptz not null default now(),
  primary key (member_id, service_id, facet_value_id),
  foreign key (member_id, service_id)
    references public.member_service_evidence (member_id, service_id) on delete cascade
);

-- Admin review queue. Nothing here acts automatically.
create table if not exists public.interview_review_flags (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.member_interviews (id) on delete cascade,
  member_id uuid not null references public.member_profiles (profile_id) on delete cascade,
  scoring_id uuid not null references public.interview_scorings (id) on delete cascade,
  claim_id text not null,
  claim_text text not null,
  service_ids uuid[] not null default '{}',
  reason text not null check (reason in (
    'unsupported', 'contradicted', 'anchor_conflict', 'firm_level_on_selected', 'technical_unverified'
  )),
  evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence) = 'array'),
  status text not null default 'open' check (status in ('open', 'dismissed', 'confirmed')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_by uuid references public.profiles (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scoring_id, claim_id, reason)
);
create index if not exists interview_review_flags_status_idx
  on public.interview_review_flags (status, created_at desc);

-- Optional anchor bank, authored by domain people (loaded by SQL for now).
create table if not exists public.service_anchor_entries (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  deliverables text[] not null default '{}',
  instruments text[] not null default '{}',
  tools text[] not null default '{}',
  practitioner_detail text not null check (char_length(practitioner_detail) between 1 and 2000),
  bluff_answer text not null check (char_length(bluff_answer) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_anchor_entries_service_idx on public.service_anchor_entries (service_id);

alter table public.interview_scorings enable row level security;
alter table public.facet_values enable row level security;
alter table public.facet_value_sources enable row level security;
alter table public.member_service_evidence enable row level security;
alter table public.member_service_subtags enable row level security;
alter table public.interview_review_flags enable row level security;
alter table public.service_anchor_entries enable row level security;

drop trigger if exists facet_values_updated_at on public.facet_values;
create trigger facet_values_updated_at before update on public.facet_values
  for each row execute function public.set_updated_at();
drop trigger if exists member_service_evidence_updated_at on public.member_service_evidence;
create trigger member_service_evidence_updated_at before update on public.member_service_evidence
  for each row execute function public.set_updated_at();
drop trigger if exists interview_review_flags_updated_at on public.interview_review_flags;
create trigger interview_review_flags_updated_at before update on public.interview_review_flags
  for each row execute function public.set_updated_at();
drop trigger if exists service_anchor_entries_updated_at on public.service_anchor_entries;
create trigger service_anchor_entries_updated_at before update on public.service_anchor_entries
  for each row execute function public.set_updated_at();

-- Atomic per-role token counters (turn engine and tracker write concurrently).
create or replace function public.interview_add_llm_usage(
  p_interview_id uuid, p_role text, p_input integer, p_output integer, p_cached integer
) returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update public.member_interviews
     set llm_usage = jsonb_set(llm_usage, array[p_role], jsonb_build_object(
           'calls', coalesce((llm_usage -> p_role ->> 'calls')::integer, 0) + 1,
           'input', coalesce((llm_usage -> p_role ->> 'input')::integer, 0) + greatest(p_input, 0),
           'output', coalesce((llm_usage -> p_role ->> 'output')::integer, 0) + greatest(p_output, 0),
           'cached', coalesce((llm_usage -> p_role ->> 'cached')::integer, 0) + greatest(p_cached, 0)
         ), true)
   where id = p_interview_id;
$function$;
revoke execute on function public.interview_add_llm_usage(uuid, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.interview_add_llm_usage(uuid, text, integer, integer, integer) to service_role;

create or replace function public.facet_value_add_source(p_facet_value_id uuid, p_member_id uuid)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count integer;
  v_status text;
begin
  insert into public.facet_value_sources (facet_value_id, member_id)
  values (p_facet_value_id, p_member_id)
  on conflict do nothing;
  select count(*) into v_count from public.facet_value_sources where facet_value_id = p_facet_value_id;
  update public.facet_values
     set source_count = v_count,
         status = case when status = 'candidate' and v_count >= 3 then 'canonical' else status end
   where id = p_facet_value_id
  returning status into v_status;
  return v_status;
end;
$function$;
revoke execute on function public.facet_value_add_source(uuid, uuid) from public, anon, authenticated;
grant execute on function public.facet_value_add_source(uuid, uuid) to service_role;

-- Replaces a member×service proposal and its proposed sub-tags in one transaction. Leaves rows the
-- member already approved or an admin activated untouched (returns false).
create or replace function public.interview_upsert_service_proposal(
  p_member_id uuid, p_service_id uuid, p_interview_id uuid, p_scoring_id uuid,
  p_role smallint, p_evidence text, p_recency_year integer, p_summary text, p_facet_value_ids uuid[]
) returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_status text;
begin
  select status into v_status from public.member_service_evidence
   where member_id = p_member_id and service_id = p_service_id
   for update;
  if v_status in ('active', 'member_approved') then
    return false;
  end if;
  insert into public.member_service_evidence (
    member_id, service_id, interview_id, scoring_id, role, evidence, recency_year, evidence_summary, status
  ) values (
    p_member_id, p_service_id, p_interview_id, p_scoring_id, p_role, p_evidence, p_recency_year, p_summary, 'proposed'
  )
  on conflict (member_id, service_id) do update
    set interview_id = excluded.interview_id,
        scoring_id = excluded.scoring_id,
        role = excluded.role,
        evidence = excluded.evidence,
        recency_year = excluded.recency_year,
        evidence_summary = excluded.evidence_summary,
        status = 'proposed';
  delete from public.member_service_subtags
   where member_id = p_member_id and service_id = p_service_id;
  insert into public.member_service_subtags (member_id, service_id, facet_value_id, status)
  select p_member_id, p_service_id, v, 'proposed' from unnest(coalesce(p_facet_value_ids, '{}')) as v
  on conflict do nothing;
  return true;
end;
$function$;
revoke execute on function public.interview_upsert_service_proposal(
  uuid, uuid, uuid, uuid, smallint, text, integer, text, uuid[]
) from public, anon, authenticated;
grant execute on function public.interview_upsert_service_proposal(
  uuid, uuid, uuid, uuid, smallint, text, integer, text, uuid[]
) to service_role;

-- Search: evidence/sub-tag changes re-index the member card (same trigger function as interviews).
drop trigger if exists member_service_evidence_search_sync on public.member_service_evidence;
create trigger member_service_evidence_search_sync after insert or delete or update
  on public.member_service_evidence for each row execute function public.interview_search_trg();
drop trigger if exists member_service_subtags_search_sync on public.member_service_subtags;
create trigger member_service_subtags_search_sync after insert or delete or update
  on public.member_service_subtags for each row execute function public.interview_search_trg();

-- Starter vocabulary. Closed facets never grow from interviews; instrument/forum do.
insert into public.facet_values (facet, label, slug, aliases)
select f::public.facet_kind, l, trim(both '-' from regexp_replace(lower(l), '[^a-z0-9]+', '-', 'g')), a
from (values
  ('jurisdiction', 'India', array['indian']),
  ('jurisdiction', 'United States (federal)', array['us', 'usa', 'u.s.', 'united states', 'us federal', 'irs']),
  ('jurisdiction', 'United States (state)', array['us state', 'state tax', 'salt']),
  ('jurisdiction', 'United Kingdom', array['uk', 'u.k.', 'england', 'britain', 'great britain']),
  ('jurisdiction', 'United Arab Emirates', array['uae', 'dubai', 'abu dhabi']),
  ('jurisdiction', 'Singapore', array[]::text[]),
  ('jurisdiction', 'European Union', array['eu', 'europe']),
  ('jurisdiction', 'Hong Kong', array['hk']),
  ('jurisdiction', 'Mauritius', array[]::text[]),
  ('jurisdiction', 'Netherlands', array['holland', 'dutch']),
  ('jurisdiction', 'Australia', array[]::text[]),
  ('jurisdiction', 'Canada', array[]::text[]),
  ('work_type', 'Advisory', array['advice', 'opinions', 'advisory work']),
  ('work_type', 'Compliance', array['filings', 'returns', 'compliance work']),
  ('work_type', 'Litigation', array['disputes', 'appeals', 'litigation work']),
  ('work_type', 'Due diligence', array['dd', 'diligence']),
  ('work_type', 'Structuring', array['restructuring', 'structuring work']),
  ('work_type', 'Implementation', array['rollout', 'set-up', 'setup']),
  ('work_type', 'Audit and assurance', array['audit', 'assurance']),
  ('work_type', 'Transaction support', array['deal support', 'transactions']),
  ('work_type', 'Valuation', array['valuations']),
  ('work_type', 'Representation before authorities', array['representation', 'assessments']),
  ('client_type', 'Startup', array['startups', 'early-stage companies']),
  ('client_type', 'Listed company', array['listed companies', 'public companies', 'listed']),
  ('client_type', 'Private company', array['private companies', 'unlisted companies']),
  ('client_type', 'MNC subsidiary', array['mnc subsidiaries', 'multinational subsidiaries', 'captives', 'mncs']),
  ('client_type', 'SME', array['smes', 'small businesses', 'mid-size companies', 'mid-market']),
  ('client_type', 'Fund', array['funds', 'pe funds', 'vc funds', 'aifs']),
  ('client_type', 'Family office', array['family offices']),
  ('client_type', 'HNI', array['hnis', 'high net worth individuals', 'individuals']),
  ('client_type', 'Non-profit', array['non-profits', 'ngos', 'charities', 'trusts']),
  ('client_type', 'Government or PSU', array['government', 'psus', 'public sector']),
  ('scale', 'Small (under USD 1M)', array['small']),
  ('scale', 'Mid (USD 1M to 50M)', array['mid', 'medium']),
  ('scale', 'Large (USD 50M to 500M)', array['large']),
  ('scale', 'Very large (over USD 500M)', array['very large']),
  ('volume', '1 to 2', array['1-2', 'one or two', 'a couple']),
  ('volume', '3 to 10', array['3-10', 'a few', 'several', 'handful']),
  ('volume', 'More than 10', array['10+', 'dozens', 'many', 'more than ten']),
  ('instrument', 'FEMA ODI', array['odi', 'overseas direct investment']),
  ('instrument', 'FEMA FDI', array['fdi', 'foreign direct investment']),
  ('instrument', 'SEBI LODR', array['lodr', 'listing regulations']),
  ('instrument', 'SEBI ICDR', array['icdr']),
  ('instrument', 'SEBI Takeover Code', array['sast', 'takeover code']),
  ('instrument', 'DPDP Act', array['dpdp', 'digital personal data protection act']),
  ('instrument', 'GDPR', array[]::text[]),
  ('instrument', 'Advance Pricing Agreement', array['apa', 'apas', 'bilateral apa', 'unilateral apa']),
  ('instrument', 'Form 3CEB', array['3ceb']),
  ('instrument', 'Form 5472', array['5472']),
  ('instrument', 'Trademark', array['trademarks', 'tm']),
  ('instrument', 'Patent', array['patents']),
  ('instrument', 'Insolvency and Bankruptcy Code', array['ibc']),
  ('instrument', 'GST', array['goods and services tax']),
  ('instrument', 'Companies Act 2013', array['companies act']),
  ('instrument', 'Income-tax Act', array['income tax act', 'it act']),
  ('instrument', 'Double Taxation Avoidance Agreement', array['dtaa', 'tax treaty', 'treaty']),
  ('forum', 'ITAT', array['income tax appellate tribunal']),
  ('forum', 'NCLT', array['national company law tribunal']),
  ('forum', 'NCLAT', array[]::text[]),
  ('forum', 'CESTAT', array[]::text[]),
  ('forum', 'AAR', array['authority for advance rulings', 'advance ruling']),
  ('forum', 'High Court', array['high courts', 'hc']),
  ('forum', 'Supreme Court of India', array['supreme court', 'sc']),
  ('forum', 'DRP', array['dispute resolution panel']),
  ('forum', 'CIT(A)', array['cit appeals', 'commissioner appeals', 'first appeal']),
  ('forum', 'GST Appellate Authority', array['gst appeals']),
  ('forum', 'IRS examination', array['irs audit', 'irs exam']),
  ('forum', 'Competition Commission of India', array['cci']),
  ('industry', 'IT services', array['it', 'software services', 'technology services']),
  ('industry', 'Manufacturing', array['manufacturers', 'industrial']),
  ('industry', 'Pharmaceuticals', array['pharma', 'life sciences']),
  ('industry', 'Banking and financial services', array['bfsi', 'banking', 'financial services', 'nbfc']),
  ('industry', 'Consumer and retail', array['retail', 'fmcg', 'consumer']),
  ('industry', 'Telecom', array['telecommunications'])
) as v (f, l, a)
on conflict (facet, slug) do nothing;

-- Industries also come from the taxonomy's Sector-Specific Practices services (labels kept as is).
insert into public.facet_values (facet, label, slug)
select 'industry', s.name, trim(both '-' from regexp_replace(lower(s.name), '[^a-z0-9]+', '-', 'g'))
from public.services s
join public.categories c on c.id = s.category_id
where c.name = 'Sector-Specific Practices'
on conflict (facet, slug) do nothing;

-- Storage: private audio bucket, service-role only (same posture as the private buckets in 0004).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('interview-audio', 'interview-audio', false, 41943040, array['audio/mpeg'])
on conflict (id) do nothing;

-- Email: drafts-ready automation, off until its Resend template is published.
insert into public.email_automations (key, name, description, resend_template, enabled) values
  ('interview_drafts_ready', 'Interview drafts ready',
   'Sent when the AI interview extraction finishes and profile drafts are ready to review.',
   'interview-drafts-ready', false)
on conflict (key) do nothing;

commit;
notify pgrst, 'reload schema';
