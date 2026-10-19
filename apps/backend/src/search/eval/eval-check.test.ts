import { describe, expect, it } from 'vitest';
import type { SearchResult } from '../search.types';
import { checkCase, type EvalCase } from './eval-check';

const base: EvalCase = { num: 1, question: 'q', kind: 'must_include', expected: [], onlyExpected: false, expectedCount: null, minCount: null, note: null, active: true };
const member = (name: string): SearchResult => ({ type: 'member', id: name, name, slug: name, headline: null, firm: null, location: '', services: [], available: true, rate: null });
const event = (title: string, startsAt: string): SearchResult => ({ type: 'event', id: title, title, slug: title, summary: null, startsAt, endsAt: null, location: '', format: null, isFree: true, registrationUrl: null });

describe('checkCase no_pii (a contact-detail leak must fail)', () => {
  const c: EvalCase = { ...base, kind: 'no_pii' };
  it('passes clean output', () => {
    expect(checkCase(c, { results: [member('Jane')], answer: 'Here is Jane.' }).passed).toBe(true);
  });
  it('fails on an email in the answer', () => {
    expect(checkCase(c, { results: [], answer: 'Mail jane@firm.com' })).toEqual({ passed: false, reason: 'an email or phone number appeared' });
  });
  it('fails on a phone number in a result', () => {
    const leaky = { ...member('Jane'), headline: 'call 415 555 0132' };
    expect(checkCase(c, { results: [leaky], answer: '' }).passed).toBe(false);
  });
});

describe('checkCase other kinds', () => {
  it('must_include reports missing and unexpected extras', () => {
    const c: EvalCase = { ...base, expected: ['A', 'B'], onlyExpected: true };
    expect(checkCase(c, { results: [member('A')], answer: '' }).reason).toBe('missing: B');
    expect(checkCase(c, { results: [member('A'), member('B'), member('C')], answer: '' }).reason).toBe('unexpected extra: C');
    expect(checkCase(c, { results: [member('b'), member('a')], answer: '' }).passed).toBe(true);
  });
  it('top checks the first result only', () => {
    const c: EvalCase = { ...base, kind: 'top', expected: ['A'] };
    expect(checkCase(c, { results: [member('B'), member('A')], answer: '' }).reason).toBe('first result was: B');
    expect(checkCase(c, { results: [], answer: '' }).reason).toBe('first result was: nothing');
  });
  it('none / count / any_results', () => {
    expect(checkCase({ ...base, kind: 'none' }, { results: [member('A')], answer: '' }).passed).toBe(false);
    expect(checkCase({ ...base, kind: 'count', expectedCount: 2 }, { results: [member('A')], answer: '' }).reason).toBe('expected 2 results, got 1');
    expect(checkCase({ ...base, kind: 'any_results', minCount: 1 }, { results: [], answer: '' }).reason).toBe('expected at least 1 results, got 0');
  });
  it('future_events rejects past and non-event results', () => {
    const c: EvalCase = { ...base, kind: 'future_events' };
    const now = Date.parse('2026-10-12T00:00:00Z');
    expect(checkCase(c, { results: [event('Past', '2026-01-01T00:00:00Z')], answer: '' }, now).passed).toBe(false);
    expect(checkCase(c, { results: [member('A')], answer: '' }, now).passed).toBe(false);
    expect(checkCase(c, { results: [event('Next', '2026-11-01T00:00:00Z')], answer: '' }, now).passed).toBe(true);
  });

  it('must_not_include fails only when a forbidden record is returned (similar results are fine)', () => {
    const c: EvalCase = { ...base, kind: 'must_not_include', expected: ['Victor Lindgren'] };
    expect(checkCase(c, { results: [member('Victor Hernandez')], answer: '' }).passed).toBe(true);
    expect(checkCase(c, { results: [], answer: '' }).passed).toBe(true);
    expect(checkCase(c, { results: [member('victor lindgren')], answer: '' })).toEqual({
      passed: false,
      reason: 'must not be returned but was: Victor Lindgren',
    });
  });

  it('compares names ignoring case and repeated whitespace (a stored "Pooja  Menon" matches "Pooja Menon")', () => {
    const c: EvalCase = { ...base, kind: 'top', expected: ['Pooja Menon'] };
    expect(checkCase(c, { results: [member('Pooja  Menon')], answer: '' }).passed).toBe(true);
    const m: EvalCase = { ...base, kind: 'must_include', expected: ['Pooja Menon'] };
    expect(checkCase(m, { results: [member('POOJA   MENON')], answer: '' }).passed).toBe(true);
  });
});
