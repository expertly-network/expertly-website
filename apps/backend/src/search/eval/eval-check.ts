import { resultTitle, type SearchResult } from '../search.types';

// Port of check() from the search-eval Edge Function. Every rule and regex is unchanged — in
// particular no_pii: any email-looking or phone-looking string in the results or answer fails.

export type EvalKind = 'must_include' | 'must_not_include' | 'top' | 'none' | 'count' | 'no_pii' | 'future_events' | 'any_results';

export interface EvalCase {
  num: number;
  question: string;
  kind: EvalKind;
  expected: string[];
  onlyExpected: boolean;
  expectedCount: number | null;
  minCount: number | null;
  note: string | null;
  active: boolean;
}

export interface EvalVerdict {
  passed: boolean;
  reason: string;
}

// Case-insensitive and whitespace-insensitive: a stored display name may contain a double space ("Pooja  Menon")
// and that must not make a correct hit look like a miss.
const norm = (s: string): string => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

export function checkCase(c: EvalCase, out: { results: SearchResult[]; answer: string }, now: number = Date.now()): EvalVerdict {
  const results = out.results ?? [];
  const titles = results.map(resultTitle);
  const expNorm = (c.expected ?? []).map(norm);
  const gotNorm = titles.map(norm);

  if (c.kind === 'must_include') {
    const missing = c.expected.filter((e) => !gotNorm.includes(norm(e)));
    if (missing.length) return { passed: false, reason: 'missing: ' + missing.join(' | ') };
    if (c.onlyExpected) {
      const extra = titles.filter((t) => !expNorm.includes(norm(t)));
      if (extra.length) return { passed: false, reason: 'unexpected extra: ' + extra.join(' | ') };
    }
  } else if (c.kind === 'must_not_include') {
    // For a record that must never be returned (draft, deactivated, deleted): other, similar results are fine.
    const forbidden = c.expected.filter((e) => gotNorm.includes(norm(e)));
    if (forbidden.length) return { passed: false, reason: 'must not be returned but was: ' + forbidden.join(' | ') };
  } else if (c.kind === 'top') {
    if (!titles.length || !expNorm.includes(gotNorm[0])) return { passed: false, reason: 'first result was: ' + (titles[0] ?? 'nothing') };
  } else if (c.kind === 'none') {
    if (results.length) return { passed: false, reason: 'expected nothing but got ' + results.length + ': ' + titles.slice(0, 3).join(' | ') };
  } else if (c.kind === 'count') {
    if (results.length !== c.expectedCount) return { passed: false, reason: 'expected ' + c.expectedCount + ' results, got ' + results.length };
  } else if (c.kind === 'no_pii') {
    const text = JSON.stringify(results) + ' ' + (out.answer ?? '');
    if (/@[a-z0-9-]+\.[a-z]{2,}/i.test(text) || /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/.test(text)) return { passed: false, reason: 'an email or phone number appeared' };
  } else if (c.kind === 'future_events') {
    const bad = results.filter((r) => r.type !== 'event' || !r.startsAt || new Date(r.startsAt).getTime() < now);
    if (bad.length) return { passed: false, reason: 'past or non-event results: ' + bad.map(resultTitle).join(' | ') };
  }
  // 'any_results' is covered by minCount below.
  if (c.kind !== 'count' && c.expectedCount != null && results.length !== c.expectedCount) {
    return { passed: false, reason: 'expected ' + c.expectedCount + ' results, got ' + results.length };
  }
  if (c.minCount != null && results.length < c.minCount) {
    return { passed: false, reason: 'expected at least ' + c.minCount + ' results, got ' + results.length };
  }
  return { passed: true, reason: 'ok' };
}
