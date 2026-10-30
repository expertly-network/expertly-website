import { randomBytes } from 'node:crypto';
import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

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
// Keeps each `slug=in.(...)` filter comfortably inside URL length limits.
const IN_CHUNK = 100;

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
  const taken = new Set<string>();
  for (let i = 0; i < slugs.length; i += IN_CHUNK) {
    const chunk = slugs.slice(i, i + IN_CHUNK);
    const { data, error } = await db.from(table).select('slug').in('slug', chunk);
    if (error) throw new InternalServerErrorException(`Failed to generate ${fallback} slug.`);
    for (const row of (data ?? []) as { slug: string }[]) taken.add(row.slug);
  }
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
// the table AND each other, using one existence query for every title's candidates (chunked)
// rather than one query per row. A base that runs out of sequential candidates falls back to
// generateUniqueSlug for that title.
export async function generateUniqueSlugs(
  db: SupabaseClient,
  table: string,
  titles: string[],
  fallback: string
): Promise<string[]> {
  const bases = titles.map((t) => slugify(t, fallback));
  const perBase = new Map<string, number>();
  for (const base of bases) perBase.set(base, (perBase.get(base) ?? 0) + 1);

  // Enough sequential candidates per base for every row sharing it, plus headroom for existing rows.
  const candidatesByBase = new Map<string, string[]>();
  for (const [base, count] of perBase) candidatesByBase.set(base, candidatesFor(base, count + 10));
  const taken = await existingSlugs(db, table, [...candidatesByBase.values()].flat(), fallback);

  const reserved = new Set<string>();
  const slugs: string[] = [];
  for (let i = 0; i < bases.length; i++) {
    const slug = candidatesByBase.get(bases[i])!.find((c) => !taken.has(c) && !reserved.has(c));
    if (slug) {
      reserved.add(slug);
      slugs.push(slug);
    } else {
      slugs.push(await generateUniqueSlug(db, table, titles[i], fallback, reserved));
    }
  }
  return slugs;
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
