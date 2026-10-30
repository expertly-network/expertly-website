// Contact-detail redaction. EMAIL / PHONE_INTL / PHONE_INTL_OR_BARE are a line-for-line port of
// the SQL / Edge Function originals — do not "improve" them casually. A real privacy leak happened
// here before. PHONE_GROUPED / WHATSAPP_LINK are additive passes on top of them (never instead).

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
/** International number (+CC …) — shared by the card writer and the response scrubber. */
const PHONE_INTL = /(\+\d[\d\s().-]{8,}\d)/g;
/** Card writer only: also strips a bare 10-digit number (Postgres `\y` == JS `\b` for ASCII). */
const PHONE_INTL_OR_BARE = /(\+\d[\d\s().-]{8,}\d)|(\b\d{10}\b)/g;

/** wa.me / api.whatsapp.com links carry the number in the path or query — drop the whole link. */
const WHATSAPP_LINK = /(?:https?:\/\/)?(?:wa\.me|(?:api|web|chat)\.whatsapp\.com)\/[^\s<>"')\]]*/gi;

/**
 * Candidate phone number in the common local formats the +CC pattern misses: (555) 123-4567,
 * 555-123-4567, 555.123.4567, 98765 43210, 0091 98765 43210, bare 919876543210. Digit groups
 * (optionally one parenthesised area code) joined by at most two of space / dot / hyphen. Not
 * preceded by a word char or path/URL punctuation, so ids, slugs, uuids and storage paths
 * (`.../1698765432101-file.pdf`) are left alone. isPhoneLike() then decides by digit count.
 */
const PHONE_GROUPED = /(?<![\w@/.+-])\+?(?:\(\d{1,5}\)|\d)(?:[ .\u00a0-]{0,2}(?:\(\d{1,5}\)|\d)){7,}(?!\w)/g;

const MIN_PHONE_DIGITS = 9;
const MIN_BARE_PHONE_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

// Years ("2019-2024"), dates ("2024-10-30") and short numbers have < 9 digits; prices written with
// thousands groups ("1 500 000 000", "1.500.000.000") are skipped by shape; a bare run needs 10+.
function isPhoneLike(candidate: string): boolean {
  const digits = candidate.replace(/\D/g, '').length;
  if (digits < MIN_PHONE_DIGITS || digits > MAX_PHONE_DIGITS) return false;
  const bare = /^\d+$/.test(candidate);
  if (bare) return digits >= MIN_BARE_PHONE_DIGITS;
  if (!candidate.startsWith('+') && !candidate.includes('(')) {
    const groups = candidate.split(/[ .\u00a0-]+/);
    const thousands =
      groups.length > 2 && /^\d{1,3}$/.test(groups[0]) && groups.slice(1).every((g) => /^\d{3}$/.test(g));
    if (thousands) return false;
  }
  return true;
}

function redactPhones(text: string): string {
  return text
    .replace(WHATSAPP_LINK, '[phone removed]')
    .replace(PHONE_GROUPED, (match) => (isPhoneLike(match) ? '[phone removed]' : match));
}

/** search_put(): applied to card text BEFORE hashing and storing, so contact details are never
 * stored in search_documents, embedded, or sent to the judge. */
export function redactCardText(text: string): string {
  return redactPhones(text.replace(EMAIL, '[email removed]').replace(PHONE_INTL_OR_BARE, '[phone removed]'));
}

/** pipeline.ts redact(): defence in depth on anything leaving the search endpoint. */
export function redactResponseText(text: string): string {
  return redactPhones(text.replace(EMAIL, '[email removed]').replace(PHONE_INTL, '[phone removed]'));
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
