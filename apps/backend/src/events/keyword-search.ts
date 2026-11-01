// Free-text keyword search over the public events list (GET /v1/events?q=). Instant, plain
// matching — the AI search (POST /v1/search) stays separate. Each meaningful word must match at
// least one of the searched columns; words are ANDed.

export const KEYWORD_COLUMNS = ['title', 'description', 'event_type', 'organiser_name', 'city', 'country'] as const;

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'at',
  'by',
  'events',
  'event',
  'for',
  'from',
  'in',
  'near',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'about',
  'upcoming',
]);

// Words a PostgREST `or=(…)` filter can carry safely: letters, digits, and inner hyphens/
// apostrophes/ampersands only (commas, parentheses, dots, % and * would change the filter itself).
// Plurals are trimmed so "webinars" finds "Webinar". At most 6 words.
export function keywordTerms(q: string): string[] {
  const words = q
    .toLowerCase()
    .normalize('NFKC')
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}'&-]/gu, '').replace(/^[-'&]+|[-'&]+$/g, ''))
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w))
    .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
  return [...new Set(words)].slice(0, 6);
}

// One `or` filter per term, for the Supabase query builder's .or().
export function keywordOrFilter(term: string): string {
  return KEYWORD_COLUMNS.map((c) => `${c}.ilike.*${term}*`).join(',');
}
