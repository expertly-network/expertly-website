import { describe, expect, it } from 'vitest';
import { aggDistinct, btrim, concatLines, formatEventDate, jsonbText, jsonbToText, line } from './card-text';

describe('jsonbText (search_jsonb_text)', () => {
  it('joins strings with "; "', () => {
    expect(jsonbText(['CFA', 'CPA'])).toBe('CFA; CPA');
  });
  it('joins object values with " - ", ordered by key length then key, skipping noise keys', () => {
    expect(
      jsonbText([{ id: 'x', role: 'Partner', company: 'Deloitte', year: '2020', isCurrent: true, url: 'http://a.b' }])
    ).toBe('Partner - Deloitte');
  });
  it('drops values with no letters and true/false', () => {
    expect(jsonbText([{ a: '2020', b: 'true', c: 'Tax' }])).toBe('Tax');
  });
  it('returns null for empty / non-array / all-filtered input', () => {
    expect(jsonbText([])).toBeNull();
    expect(jsonbText({ a: 'b' })).toBeNull();
    expect(jsonbText([{ year: '2020' }, 5, null])).toBeNull();
  });
});

describe('jsonbToText', () => {
  it('matches Postgres jsonb::text formatting and key order', () => {
    expect(jsonbToText({ bb: [1, 'x'], a: null, c: true })).toBe('{"a": null, "c": true, "bb": [1, "x"]}');
  });
});

describe('helpers', () => {
  it('btrim only trims spaces', () => {
    expect(btrim('  a b \n ')).toBe('a b \n');
  });
  it('concatLines skips nulls; line() drops a null value', () => {
    expect(concatLines(['A', line('B: ', null), line('C: ', 'x')])).toBe('A\nC: x');
  });
  it('aggDistinct dedupes and sorts', () => {
    expect(aggDistinct(['b', 'a', 'b', null], '; ')).toBe('a; b');
    expect(aggDistinct([null], '; ')).toBeNull();
  });
  it('formatEventDate matches to_char FMDay, FMDD FMMonth YYYY (UTC)', () => {
    expect(formatEventDate('2026-10-05T23:30:00+00:00')).toBe('Monday, 5 October 2026');
  });
});
