import { randomBytes } from 'node:crypto';
import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mapInParallel } from './batched';

// Kebab-cases a title for use as the base of a slug.
export function slugify(title: string, fallback: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback;
}

// How many sequential candidates (`base`, `base-2` ... `base-N`) one existence query checks.
// Past that, a random suffix is used instead of scanning further — so the cost stays at two small
// queries however many rows share a title (an earlier version read every `base-%` slug, which
// PostgREST silently truncates at 1000 rows and then picked a "free" suffix that wasn't).
const SEQUENTIAL_CANDIDATES = 50;
// Keeps each `slug=in.(...)` filter comfortably inside URL length limits: at most this many slugs
// and this many URL-encoded characters per query (long titles make long slugs).
const IN_CHUNK = 100;
const IN_CHUNK_CHARS = 6000;
// After a batch's first-choice slugs, how many further sequential suffixes a colliding base tries
// before falling back to a random suffix. Kept small so re-importing thousands of existing titles
// stays a handful of queries rather than tens of thousands.
const BATCH_EXTRA_CANDIDATES = 3;
// How many of those chunked existence queries run at once — a 10k-row CSV import needs ~100+.
const IN_CONCURRENCY = 8;

function candidatesFor(base: string, count: number): string[] {
  return [base, ...Array.from({ length: count - 1 }, (_, i) => `${base}-${i + 2}`)];
}

function randomSuffixed(base: string): string {
  return `${base}-${randomBytes(4).toString('hex')}`;
}

// The subset of `slugs` already present in `table`.
async function existingSlugs(
  db: SupabaseClient,
  table: string,
  slugs: string[],
  fallback: string
): Promise<Set<string>> {
  const chunks: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const slug of slugs) {
    const length = encodeURIComponent(slug).length + 3; // + the encoded "," separator
    if (current.length > 0 && (current.length >= IN_CHUNK || chars + length > IN_CHUNK_CHARS)) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(slug);
    chars += length;
  }
  if (current.length > 0) chunks.push(current);

  const taken = new Set<string>();
  await mapInParallel(chunks, IN_CONCURRENCY, async (chunk) => {
    const { data, error } = await db.from(table).select('slug').in('slug', chunk);
    if (error) throw new InternalServerErrorException(`Failed to generate ${fallback} slug.`);
    for (const row of (data ?? []) as { slug: string }[]) taken.add(row.slug);
  });
  return taken;
}

// Generates a slug for a title: the first free of `base`, `base-2`, `base-3`, ... (checked in one
// query), else `base-<random hex>`. `reserved`, when passed, also treats any slug already in that
// set as taken — callers inserting several new rows in one batch pass the same Set across calls
// so two rows sharing a title don't both land on the same slug.
//
// Check-then-insert is inherently racy (two requests can pick the same free slug); wrap the
// insert in `withUniqueSlugRetry` so the loser regenerates instead of failing.
export async function generateUniqueSlug(
  db: SupabaseClient,
  table: string,
  title: string,
  fallback: string,
  reserved?: Set<string>
): Promise<string> {
  const base = slugify(title, fallback);
  const candidates = candidatesFor(base, SEQUENTIAL_CANDIDATES);
  const taken = await existingSlugs(db, table, candidates, fallback);
  let slug = candidates.find((c) => !taken.has(c) && !reserved?.has(c));
  while (!slug) {
    const candidate = randomSuffixed(base);
    if (reserved?.has(candidate)) continue;
    if (!(await existingSlugs(db, table, [candidate], fallback)).has(candidate)) slug = candidate;
  }
  reserved?.add(slug);
  return slug;
}

// Batch form for bulk inserts (e.g. CSV import): one slug per title, in order, unique against
// the table AND each other. Every pass is a chunked, parallel existence query, so a 10k-row import
// costs a few hundred small queries rather than thousands of sequential ones (which took minutes
// and timed the import out):
//   1. only the candidates each base strictly needs (`base` … `base-N` for N rows sharing it);
//   2. for bases where one of those was taken, a few more sequential suffixes;
//   3. rows still without a slug get `base-<random hex>`, checked together (a clash there is
//      practically impossible; one falls back to generateUniqueSlug for that title).
export async function generateUniqueSlugs(
  db: SupabaseClient,
  table: string,
  titles: string[],
  fallback: string
): Promise<string[]> {
  const bases = titles.map((t) => slugify(t, fallback));
  const perBase = new Map<string, number>();
  for (const base of bases) perBase.set(base, (perBase.get(base) ?? 0) + 1);

  const candidatesByBase = new Map<string, string[]>();
  for (const [base, count] of perBase) candidatesByBase.set(base, candidatesFor(base, count));
  const taken = await existingSlugs(db, table, [...candidatesByBase.values()].flat(), fallback);

  const extra: string[] = [];
  for (const [base, candidates] of candidatesByBase) {
    if (!candidates.some((c) => taken.has(c))) continue;
    const longer = candidatesFor(base, candidates.length + BATCH_EXTRA_CANDIDATES);
    extra.push(...longer.slice(candidates.length));
    candidatesByBase.set(base, longer);
  }
  if (extra.length > 0) {
    for (const slug of await existingSlugs(db, table, extra, fallback)) taken.add(slug);
  }

  const reserved = new Set<string>();
  const slugs: (string | null)[] = bases.map((base) => {
    const slug = candidatesByBase.get(base)!.find((c) => !taken.has(c) && !reserved.has(c));
    if (!slug) return null;
    reserved.add(slug);
    return slug;
  });

  const randomByIndex = new Map<number, string>();
  slugs.forEach((slug, i) => {
    if (slug !== null) return;
    let candidate = randomSuffixed(bases[i]);
    while (reserved.has(candidate)) candidate = randomSuffixed(bases[i]);
    reserved.add(candidate);
    randomByIndex.set(i, candidate);
  });
  if (randomByIndex.size > 0) {
    const randomTaken = await existingSlugs(db, table, [...randomByIndex.values()], fallback);
    for (const [i, candidate] of randomByIndex) {
      if (!randomTaken.has(candidate)) {
        slugs[i] = candidate;
        continue;
      }
      reserved.delete(candidate);
      slugs[i] = await generateUniqueSlug(db, table, titles[i], fallback, reserved);
    }
  }
  return slugs as string[];
}

/** True for a Postgres unique violation (23505) on a slug constraint/index. */
export function isSlugUniqueViolation(error: { code?: string; message?: string; details?: string } | null): boolean {
  return error?.code === '23505' && /slug/i.test(`${error.message ?? ''} ${error.details ?? ''}`);
}

/** 409 for an insert that lost a slug race; `withUniqueSlugRetry` retries on it. */
export class SlugTakenException extends ConflictException {
  constructor(code: string, message = 'Slug already exists.') {
    super({ code, message });
  }
}

const SLUG_INSERT_ATTEMPTS = 3;

// Generates a slug and inserts with it, regenerating and retrying when the insert loses a race
// to a concurrent insert of the same slug (the repository throws SlugTakenException on a 23505
// on slug). The fresh generate sees the winner's row, so it picks the next free slug. `S` is a
// slug or, for a bulk insert, the whole batch's slugs (regenerated together).
export async function withUniqueSlugRetry<S, T>(
  generate: () => Promise<S>,
  insert: (slug: S) => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const slug = await generate();
    try {
      return await insert(slug);
    } catch (error) {
      if (!(error instanceof SlugTakenException) || attempt >= SLUG_INSERT_ATTEMPTS) throw error;
    }
  }
}
