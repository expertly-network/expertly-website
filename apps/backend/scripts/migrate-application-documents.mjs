// One-off: moves membership-application vetting documents out of the PUBLIC application-assets
// bucket (guessable "members/application/<uid>/document-<n>.<ext>" paths) into the PRIVATE
// application-documents bucket ("<uid>/<documentId>.<ext>"), rewrites each application's
// `documents` JSON to the new paths, then deletes the public copies.
//
// Order of operations, so no run can lose a document:
//   1. Plan: load every application, decide which row owns each legacy object.
//   2. Copy every owned object into the private bucket and verify each copy exists. Any download
//      or upload error other than a genuine "object not found" aborts the run here — before any
//      row is rewritten or anything is deleted.
//   3. Rewrite the rows to the private paths.
//   4. Delete public `document-*` objects only when NO application row (re-read fresh) references
//      them AND a private copy of the same size is verified to exist.
//
// Shared legacy objects: keys were numbered per application ("document-1", "document-2", ...), so
// a second application of the same applicant overwrote the first one's "document-1". The object
// then holds the NEWER upload — it's assigned to the row whose document metadata (sizeBytes)
// matches the stored object, falling back to the newest application. The other rows' entries are
// repointed to a private path that has no object (the API omits a document it can't sign, exactly
// as it already did for these) so they stop referencing the public file.
//
// Idempotent: documents already outside the legacy prefix are skipped, so it's safe to re-run
// after a partial failure. Run once per environment, after the database update has created the
// private bucket (docs/deployment.md, "Security & audit rollout" step 1):
//
//   cd apps/backend && node --env-file=.env scripts/migrate-application-documents.mjs [--dry-run]
import { createClient } from '@supabase/supabase-js';

const LEGACY_PREFIX = 'members/application/';
const PUBLIC_BUCKET = 'application-assets';
const PRIVATE_BUCKET = 'application-documents';
const PAGE_SIZE = 200;
const LIST_PAGE_SIZE = 1000;

const dryRun = process.argv.includes('--dry-run');
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  process.stderr.write('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n');
  process.exit(1);
}
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

function log(message) {
  process.stdout.write(`${dryRun ? '[dry-run] ' : ''}${message}\n`);
}

function isLegacyPath(path) {
  return typeof path === 'string' && path.startsWith(LEGACY_PREFIX);
}

function privatePathFor(applicantId, doc) {
  const ext = doc.path.split('.').pop();
  return `${applicantId}/${doc.id}.${ext}`;
}

// Storage answers a missing object with 400/404 and "Object not found" — only that is a skip.
function isNotFound(error) {
  if (!error) return false;
  const status = Number(error.status ?? error.statusCode ?? error.originalError?.status);
  const message = String(error.message ?? '');
  return status === 404 || /object not found|not_found|not found/i.test(message);
}

// Every application, newest first (ties broken by id, so the order is stable).
async function loadApplications() {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('membership_applications')
      .select('id, applicant_id, created_at, documents')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`list applications: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
  }
  return rows.map((row) => ({ ...row, documents: Array.isArray(row.documents) ? row.documents : [] }));
}

// name -> { size } for every object directly in `folder`.
async function listFolder(bucket, folder) {
  const objects = new Map();
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: LIST_PAGE_SIZE, offset });
    if (error) throw new Error(`list ${bucket}/${folder}: ${error.message}`);
    for (const o of data ?? []) {
      if (o.id === null) continue; // a sub-folder placeholder, not an object
      objects.set(o.name, { size: typeof o.metadata?.size === 'number' ? o.metadata.size : null });
    }
    if (!data || data.length < LIST_PAGE_SIZE) break;
  }
  return objects;
}

// Picks the row that owns a legacy object: the one whose recorded size matches the stored object,
// else the newest application referencing it (candidates arrive newest-first).
function pickOwner(candidates, objectSize) {
  if (objectSize !== null) {
    const bySize = candidates.find((c) => c.doc.sizeBytes === objectSize);
    if (bySize) return bySize;
  }
  return candidates[0];
}

async function copyToPrivate(legacyPath, newPath, mimeType) {
  const { data: blob, error: downloadError } = await supabase.storage.from(PUBLIC_BUCKET).download(legacyPath);
  if (downloadError || !blob) {
    if (isNotFound(downloadError)) return false;
    // Anything else (network, auth, 5xx) must stop the run before rows change or files go.
    throw new Error(`download ${legacyPath}: ${downloadError?.message ?? 'no data'}`);
  }
  const { error: uploadError } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(newPath, Buffer.from(await blob.arrayBuffer()), { contentType: mimeType, upsert: true });
  if (uploadError) throw new Error(`upload ${newPath}: ${uploadError.message}`);
  return true;
}

async function main() {
  // ---- 1. Plan ---------------------------------------------------------------------------------
  const rows = await loadApplications();
  /** legacyPath -> [{ row, doc }] newest application first */
  const referencesByPath = new Map();
  for (const row of rows) {
    for (const doc of row.documents) {
      if (!isLegacyPath(doc.path)) continue;
      const list = referencesByPath.get(doc.path) ?? [];
      list.push({ row, doc });
      referencesByPath.set(doc.path, list);
    }
  }
  const applicantIds = new Set(rows.map((r) => r.applicant_id));
  const publicListings = new Map();
  for (const applicantId of applicantIds) {
    publicListings.set(applicantId, await listFolder(PUBLIC_BUCKET, `${LEGACY_PREFIX}${applicantId}`));
  }

  /** entryKey(row, doc) -> new private path */
  const newPathByEntry = new Map();
  /** Private copies made this run, verified before any row changes. */
  const copies = [];
  let copied = 0;
  let missing = 0;
  let shared = 0;

  // ---- 2. Copy + verify ------------------------------------------------------------------------
  for (const [legacyPath, candidates] of referencesByPath) {
    const applicantId = candidates[0].row.applicant_id;
    const name = legacyPath.slice(`${LEGACY_PREFIX}${applicantId}/`.length);
    const meta = publicListings.get(applicantId)?.get(name);
    if (!meta) {
      // Genuinely gone: nothing public to protect; rows keep their entry (the API omits it).
      log(`not found, leaving as is: ${legacyPath}`);
      missing += 1;
      continue;
    }
    const owner = pickOwner(candidates, meta.size);
    const ownerPath = privatePathFor(applicantId, owner.doc);
    if (candidates.length > 1) {
      shared += 1;
      log(
        `shared object ${legacyPath}: assigned to application ${owner.row.id} (${owner.row.created_at}); ` +
          `${candidates.length - 1} other entr${candidates.length === 2 ? 'y' : 'ies'} repointed to an empty private path`
      );
    }
    if (!dryRun && !(await copyToPrivate(legacyPath, ownerPath, owner.doc.mimeType))) {
      log(`not found on download, leaving as is: ${legacyPath}`);
      missing += 1;
      continue;
    }
    for (const c of candidates) {
      newPathByEntry.set(entryKey(c.row, c.doc), c === owner ? ownerPath : privatePathFor(applicantId, c.doc));
    }
    copies.push({ applicantId, path: ownerPath, size: meta.size });
    copied += 1;
  }

  if (!dryRun) {
    // Verify every copy before touching a row.
    const privateListings = new Map();
    for (const copy of copies) {
      if (!privateListings.has(copy.applicantId)) {
        privateListings.set(copy.applicantId, await listFolder(PRIVATE_BUCKET, copy.applicantId));
      }
      const stored = privateListings.get(copy.applicantId).get(copy.path.slice(copy.applicantId.length + 1));
      if (!stored || (copy.size !== null && stored.size !== null && stored.size !== copy.size)) {
        throw new Error(`verify ${PRIVATE_BUCKET}/${copy.path}: private copy missing or wrong size`);
      }
    }
  }

  // ---- 3. Rewrite rows -------------------------------------------------------------------------
  let rowsUpdated = 0;
  for (const row of rows) {
    let changed = false;
    const updated = row.documents.map((d) => {
      const newPath = newPathByEntry.get(entryKey(row, d));
      if (!newPath || !isLegacyPath(d.path)) return d;
      changed = true;
      return { ...d, path: newPath };
    });
    if (!changed) continue;
    rowsUpdated += 1;
    log(`application ${row.id}: rewriting document paths`);
    if (dryRun) continue;
    const { error } = await supabase.from('membership_applications').update({ documents: updated }).eq('id', row.id);
    if (error) throw new Error(`update application ${row.id}: ${error.message}`);
  }

  // ---- 4. Delete public copies (only unreferenced + verified copied) ---------------------------
  // The referenced set is computed fresh from the database (a dry run simulates the rewrite).
  let removed = 0;
  let kept = 0;
  const referenced = dryRun
    ? new Set(rows.flatMap((r) => r.documents.filter((d) => !newPathByEntry.has(entryKey(r, d))).map((d) => d.path)))
    : new Set((await loadApplications()).flatMap((r) => r.documents.map((d) => d.path)));
  const plannedCopies = new Set(dryRun ? [...referencesByPath.keys()].filter((p) => isPlannedMove(p)) : []);
  for (const applicantId of applicantIds) {
    const folder = `${LEGACY_PREFIX}${applicantId}`;
    const publicObjects = dryRun ? publicListings.get(applicantId) : await listFolder(PUBLIC_BUCKET, folder);
    const privateSizes = [...(await listFolder(PRIVATE_BUCKET, applicantId)).values()].map((o) => o.size);
    const deletable = [];
    for (const [name, meta] of publicObjects) {
      if (!name.startsWith('document-')) continue;
      const path = `${folder}/${name}`;
      if (referenced.has(path)) {
        kept += 1;
        continue;
      }
      const hasPrivateCopy = plannedCopies.has(path) || (meta.size !== null && privateSizes.includes(meta.size));
      if (!hasPrivateCopy) {
        log(`keeping ${path}: unreferenced, but no private copy of the same size was found`);
        kept += 1;
        continue;
      }
      deletable.push(path);
    }
    if (deletable.length === 0) continue;
    log(`applicant ${applicantId}: removing ${deletable.length} public document(s)`);
    if (!dryRun) {
      const { error } = await supabase.storage.from(PUBLIC_BUCKET).remove(deletable);
      if (error) throw new Error(`remove public copies in ${folder}: ${error.message}`);
    }
    removed += deletable.length;
  }

  function isPlannedMove(path) {
    return (referencesByPath.get(path) ?? []).every((c) => newPathByEntry.has(entryKey(c.row, c.doc)));
  }

  log(
    `Summary: ${rows.length} application(s); ${referencesByPath.size} legacy object(s) referenced — ` +
      `${copied} ${dryRun ? 'to copy' : 'copied'} to ${PRIVATE_BUCKET}, ${missing} not found, ${shared} shared; ` +
      `${rowsUpdated} row(s) ${dryRun ? 'to rewrite' : 'rewritten'}; ${removed} public copie(s) ` +
      `${dryRun ? 'to remove' : 'removed'}, ${kept} kept.`
  );
}

function entryKey(row, doc) {
  return `${row.id}\u0000${doc.id}`;
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
