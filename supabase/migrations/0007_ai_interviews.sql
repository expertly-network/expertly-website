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
  assessment jsonb,
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
