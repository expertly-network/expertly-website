-- ============================================================================
-- 2026-10-29 security & performance hardening — for an EXISTING database.
--
-- supabase/migrations/0001–0004 are the ground-truth schema (pre-production convention, see
-- supabase/migrations/README.md) and already contain everything below, so a fresh rebuild needs
-- nothing from this file. A database built from an earlier version of those files does: run this
-- once in the SQL Editor. Every statement is idempotent — safe to re-run.
--
-- After running it: `node --env-file=.env scripts/migrate-application-documents.mjs` (from
-- apps/backend) moves already-uploaded vetting documents out of the public bucket.
-- ============================================================================

begin;

-- ---- Storage: no direct client writes; size + type limits on every bucket ----------------

drop policy if exists member_proofs_owner_rw on storage.objects;
drop policy if exists ai_draft_sources_owner_rw on storage.objects;
drop policy if exists application_assets_owner_all on storage.objects;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-documents', 'application-documents', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'member-proofs';

update storage.buckets set file_size_limit = 15728640 where id = 'ai-draft-sources';

update storage.buckets
   set file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
 where id = 'application-assets';

update storage.buckets set file_size_limit = 5242880 where id = 'resource-assets';

update storage.buckets
   set file_size_limit = 15728640,
       allowed_mime_types = array['application/pdf',
                                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                  'application/vnd.openxmlformats-officedocument.presentationml.presentation']
 where id = 'template-files';

commit;
