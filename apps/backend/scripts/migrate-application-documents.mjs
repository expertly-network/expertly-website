// One-off: moves membership-application vetting documents out of the PUBLIC application-assets
// bucket (guessable "members/application/<uid>/document-<n>.<ext>" paths) into the PRIVATE
// application-documents bucket ("<uid>/<documentId>.<ext>"), rewrites each application's
// `documents` JSON to the new paths, then deletes the public copies.
//
// Idempotent: documents already outside the legacy prefix are skipped, so it's safe to re-run
// after a partial failure. Run once per environment, after supabase/patches/
// 2026-10-29_security_hardening.sql has created the private bucket:
//
//   cd apps/backend && node --env-file=.env scripts/migrate-application-documents.mjs [--dry-run]
import { createClient } from '@supabase/supabase-js';

const LEGACY_PREFIX = 'members/application/';
const PUBLIC_BUCKET = 'application-assets';
const PRIVATE_BUCKET = 'application-documents';
const PAGE_SIZE = 200;

const dryRun = process.argv.includes('--dry-run');
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  process.stderr.write('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n');
  process.exit(1);
}
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

function log(message) {
  process.stdout.write(`${message}\n`);
}

async function migrateDocument(applicantId, doc) {
  const ext = doc.path.split('.').pop();
  const newPath = `${applicantId}/${doc.id}.${ext}`;
  if (dryRun) return newPath;

  const { data: blob, error: downloadError } = await supabase.storage.from(PUBLIC_BUCKET).download(doc.path);
  if (downloadError || !blob) throw new Error(`download ${doc.path}: ${downloadError?.message ?? 'missing'}`);

  const { error: uploadError } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(newPath, Buffer.from(await blob.arrayBuffer()), { contentType: doc.mimeType, upsert: true });
  if (uploadError) throw new Error(`upload ${newPath}: ${uploadError.message}`);
  return newPath;
}

async function main() {
  let moved = 0;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: rows, error } = await supabase
      .from('membership_applications')
      .select('id, applicant_id, documents')
      .order('created_at')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`list applications: ${error.message}`);
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      const documents = Array.isArray(row.documents) ? row.documents : [];
      const legacy = documents.filter((d) => typeof d.path === 'string' && d.path.startsWith(LEGACY_PREFIX));
      if (legacy.length === 0) continue;

      const pathMap = new Map();
      for (const doc of legacy) pathMap.set(doc.path, await migrateDocument(row.applicant_id, doc));
      log(`${dryRun ? '[dry-run] ' : ''}application ${row.id}: ${legacy.length} document(s)`);
      if (dryRun) continue;

      const updated = documents.map((d) => (pathMap.has(d.path) ? { ...d, path: pathMap.get(d.path) } : d));
      const { error: updateError } = await supabase
        .from('membership_applications')
        .update({ documents: updated })
        .eq('id', row.id);
      if (updateError) throw new Error(`update application ${row.id}: ${updateError.message}`);

      // Only after the row points at the private copies — a failure above leaves the public
      // originals in place and the next run retries.
      const { error: removeError } = await supabase.storage.from(PUBLIC_BUCKET).remove([...pathMap.keys()]);
      if (removeError) throw new Error(`remove public copies for ${row.id}: ${removeError.message}`);
      moved += legacy.length;
    }
  }
  log(`${dryRun ? 'Dry run complete.' : `Moved ${moved} document(s) to ${PRIVATE_BUCKET}.`}`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
