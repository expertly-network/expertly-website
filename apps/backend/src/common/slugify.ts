import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';

// Kebab-cases a title for use as the base of a slug. Shared by every resource that generates
// slugs server-side (root CLAUDE.md's non-negotiable rule) — articles and events today.
export function slugify(title: string, fallback: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || fallback;
}

// Disambiguates against the table's real unique constraint by appending `-2`, `-3`, ... rather
// than trusting an in-memory check for a race-free guarantee.
export async function generateUniqueSlug(
  db: SupabaseClient,
  table: string,
  title: string,
  fallback: string
): Promise<string> {
  const base = slugify(title, fallback);
  let candidate = base;
  for (let suffix = 2; ; suffix++) {
    const { data, error } = await db.from(table).select('id').eq('slug', candidate).maybeSingle();

    if (error) throw new InternalServerErrorException(`Failed to generate ${fallback} slug.`);
    if (!data) return candidate;
    candidate = `${base}-${suffix}`;
  }
}
