import type { FacetKind } from '@shared/subtags';

/** Facets that never grow from interviews (spec §7.3): unmatched values are dropped. */
export const CLOSED_FACETS: ReadonlySet<FacetKind> = new Set<FacetKind>([
  'jurisdiction',
  'work_type',
  'client_type',
  'industry',
  'scale',
  'volume',
]);

export interface FacetValueRow {
  id: string;
  facet: FacetKind;
  label: string;
  slug: string;
  status: 'canonical' | 'candidate' | 'rejected';
  aliases: string[];
  sourceCount: number;
}

export function normaliseFacetText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Same rule as the SQL seed: lower-case, non-alphanumerics → '-', trimmed. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function matchFacetValue(raw: string, values: FacetValueRow[]): FacetValueRow | null {
  const needle = normaliseFacetText(raw);
  if (!needle) return null;
  return (
    values.find(
      (v) =>
        v.status !== 'rejected' &&
        (normaliseFacetText(v.label) === needle || v.aliases.some((a) => normaliseFacetText(a) === needle))
    ) ?? null
  );
}
