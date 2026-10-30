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
  if (!blob) {
    // Legacy keys were numbered per application, so two applications of one applicant could share
    // "document-1"; once the first is migrated the object is gone. Leave this entry as it is
    // (the API simply omits a document it can't sign) rather than failing every run.
    log(`skipping ${doc.path}: ${downloadError?.message ?? 'not found'}`);
    return null;
  }

  const { error: uploadError } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(newPath, Buffer.from(await blob.arrayBuffer()), { contentType: doc.mimeType, upsert: true });
  if (uploadError) throw new Error(`upload ${newPath}: ${uploadError.message}`);
  return newPath;
}

// Public `document-*` objects for an applicant whose row no longer references them.
async function removeOrphanedPublicDocuments(applicantId) {
  const folder = `${LEGACY_PREFIX}${applicantId}`;
  const { data: objects, error } = await supabase.storage.from(PUBLIC_BUCKET).list(folder, { limit: 100 });
  if (error) throw new Error(`list ${folder}: ${error.message}`);
  const orphans = (objects ?? []).filter((o) => o.name.startsWith('document-')).map((o) => `${folder}/${o.name}`);
  if (orphans.length === 0) return 0;
  log(`applicant ${applicantId}: removing ${orphans.length} orphaned public document(s)`);
  const { error: removeError } = await supabase.storage.from(PUBLIC_BUCKET).remove(orphans);
  if (removeError) throw new Error(`remove orphans in ${folder}: ${removeError.message}`);
  return orphans.length;
}

async function main() {
  let moved = 0;
  const applicantIds = new Set();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: rows, error } = await supabase
      .from('membership_applications')
      .select('id, applicant_id, documents')
      .order('created_at')
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`list applications: ${error.message}`);
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      const documents = Array.isArray(row.documents) ? row.documents : [];
      const legacy = documents.filter((d) => typeof d.path === 'string' && d.path.startsWith(LEGACY_PREFIX));
      applicantIds.add(row.applicant_id);
      if (legacy.length === 0) continue;

      const pathMap = new Map();
      for (const doc of legacy) {
        const newPath = await migrateDocument(row.applicant_id, doc);
        if (newPath) pathMap.set(doc.path, newPath);
      }
      if (pathMap.size === 0) continue;
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
      moved += pathMap.size;
    }
  }
  // Second pass, only once EVERY row has been migrated (a failure above exits before this): a
  // previous run that died between a row update and its delete left public copies behind, which
  // no row references any more. Never run per row inside the loop — another, not-yet-migrated
  // application of the same applicant could still need its public originals.
  let swept = 0;
  if (!dryRun) {
    for (const applicantId of applicantIds) swept += await removeOrphanedPublicDocuments(applicantId);
  }
  log(
    `${dryRun ? 'Dry run complete.' : `Moved ${moved} document(s) to ${PRIVATE_BUCKET}; removed ${swept} orphaned public copies.`}`
  );
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
