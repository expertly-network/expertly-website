import { InternalServerErrorException } from '@nestjs/common';
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

// Generates a slug for a title, appending `-2`, `-3`, ... until it's unique in the given table.
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
