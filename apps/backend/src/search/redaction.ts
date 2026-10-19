// Contact-detail redaction. These regexes are a line-for-line port of the SQL / Edge Function
// originals — do not "improve" them casually. A real privacy leak happened here before.

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** International number (+CC …) — shared by the card writer and the response scrubber. */
const PHONE_INTL = /(\+\d[\d\s().-]{8,}\d)/g;
/** Card writer only: also strips a bare 10-digit number (Postgres `\y` == JS `\b` for ASCII). */
const PHONE_INTL_OR_BARE = /(\+\d[\d\s().-]{8,}\d)|(\b\d{10}\b)/g;

/** search_put(): applied to card text BEFORE hashing and storing, so contact details are never
 * stored in search_documents, embedded, or sent to the judge. */
export function redactCardText(text: string): string {
  return text.replace(EMAIL, '[email removed]').replace(PHONE_INTL_OR_BARE, '[phone removed]');
}

/** pipeline.ts redact(): defence in depth on anything leaving the search endpoint. */
export function redactResponseText(text: string): string {
  return text.replace(EMAIL, '[email removed]').replace(PHONE_INTL, '[phone removed]');
}

/** pipeline.ts scrub(): redacts every string in an arbitrary JSON-like value. */
export function scrubResponse<T>(value: T): T {
  return scrubValue(value) as T;
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return redactResponseText(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubValue(v);
    return out;
  }
  return value;
}
