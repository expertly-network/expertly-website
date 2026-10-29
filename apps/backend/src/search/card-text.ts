// Pure text helpers that reproduce Postgres behaviour the card builder used to rely on
// (search_jsonb_text, jsonb::text, string ordering, to_char, btrim). Kept free of Nest/Supabase.

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// The dev DB collation is en_US.UTF-8; string_agg(distinct …) / order by sort with it.
const collator = new Intl.Collator('en-US');
export function pgCompare(a: string, b: string): number {
  return collator.compare(a, b);
}

/** Postgres btrim(s) with no characters argument: trims spaces only. */
export function btrim(s: string): string {
  return s.replace(/^ +| +$/g, '');
}

/** nullif(s, '') */
export function nz(s: string | null | undefined): string | null {
  return s === null || s === undefined || s === '' ? null : s;
}

/** `label || value` — SQL concatenation with NULL yields NULL, so the line is dropped. */
export function line(label: string, value: string | null | undefined): string | null {
  return value === null || value === undefined ? null : label + value;
}

/** concat_ws(E'\n', …): skips NULLs. */
export function concatLines(lines: (string | null)[]): string {
  return lines.filter((l): l is string => l !== null).join('\n');
}

/** string_agg(distinct v, sep order by v) over non-null values, default collation. */
export function aggDistinct(values: (string | null)[], sep: string): string | null {
  const distinct = [...new Set(values.filter((v): v is string => v !== null))].sort(pgCompare);
  return distinct.length ? distinct.join(sep) : null;
}

/** jsonb stores object keys sorted by (byte length, bytes); iteration and ::text follow that. */
export function jsonbKeys(obj: { [key: string]: JsonValue }): string[] {
  return Object.keys(obj).sort((a, b) => {
    const la = Buffer.byteLength(a);
    const lb = Buffer.byteLength(b);
    return la !== lb ? la - lb : Buffer.compare(Buffer.from(a), Buffer.from(b));
  });
}

/** jsonb::text — `{"a": 1, "b": [1, 2]}` formatting, canonical key order. */
export function jsonbToText(v: JsonValue): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return '[' + v.map(jsonbToText).join(', ') + ']';
  if (typeof v === 'object') {
    return '{' + jsonbKeys(v).map((k) => JSON.stringify(k) + ': ' + jsonbToText(v[k])).join(', ') + '}';
  }
  return typeof v === 'string' ? JSON.stringify(v) : String(v);
}

/** jsonb_each_text value: strings raw, JSON null -> SQL NULL, everything else its jsonb text. */
export function jsonbEachText(obj: { [key: string]: JsonValue }): { key: string; value: string | null }[] {
  return jsonbKeys(obj).map((key) => {
    const v = obj[key];
    return { key, value: v === null ? null : typeof v === 'string' ? v : jsonbToText(v) };
  });
}

// Never in a card: layout/noise keys, and every field the API keeps owner/admin-only
// (members/member-sections.ts normalizeLiveItem) — proof attachments (private storage paths and
// links), third-party client emails, verification details. Card text is embedded, sent to the
// search judge, and can surface in its answer to any signed-in user.
const SKIPPED_KEYS = new Set([
  'id', 'url', 'logoUrl', 'logo_url', 'isCurrent', 'startYear', 'endYear', 'year', 'proofUrl',
  'proofAttachments', 'clientEmail', 'verificationMethods', 'verificationMethodOther', 'logoUploadPath', 'isVerified',
]);

/** search_jsonb_text(): flattens a jsonb array of strings / objects into "a - b; c - d". */
export function jsonbText(arr: JsonValue | undefined): string | null {
  if (!Array.isArray(arr)) return null;
  const items: string[] = [];
  for (const el of arr) {
    let item: string | null = null;
    if (typeof el === 'string') {
      item = el;
    } else if (el !== null && typeof el === 'object' && !Array.isArray(el)) {
      const parts = jsonbEachText(el)
        .filter((kv): kv is { key: string; value: string } => kv.value !== null)
        .filter((kv) => !SKIPPED_KEYS.has(kv.key) && /[A-Za-z]/.test(kv.value) && kv.value !== 'true' && kv.value !== 'false')
        // order by length(key), key
        .sort((a, b) => (a.key.length !== b.key.length ? a.key.length - b.key.length : pgCompare(a.key, b.key)))
        .map((kv) => kv.value);
      item = parts.length ? parts.join(' - ') : null;
    }
    if (item !== null) items.push(item);
  }
  const joined = items.join('; ');
  return joined === '' ? null : joined;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** to_char(ts at time zone 'UTC', 'FMDay, FMDD FMMonth YYYY') */
export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  const year = String(d.getUTCFullYear()).padStart(4, '0');
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${year}`;
}
