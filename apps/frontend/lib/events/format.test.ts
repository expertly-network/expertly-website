import { describe, expect, it } from 'vitest';
import { normalizeEventTitle } from './format';

describe('normalizeEventTitle', () => {
  it('title-cases an all-caps title and keeps acronyms', () => {
    expect(normalizeEventTitle('SEMINAR ON FILING OF MCA FORMS UNDER COMPANIES ACT 2025')).toBe(
      'Seminar on Filing of MCA Forms under Companies Act 2025'
    );
  });

  it('fixes spacing before punctuation', () => {
    expect(normalizeEventTitle('Restructuring of Companies under IBC , 2016')).toBe(
      'Restructuring of Companies under IBC, 2016'
    );
  });

  it('leaves an ordinary mixed-case title alone', () => {
    expect(normalizeEventTitle('GST Updates for SMEs in 2026')).toBe('GST Updates for SMEs in 2026');
  });

  it('collapses repeated whitespace', () => {
    expect(normalizeEventTitle('  Transfer   Pricing  Summit ')).toBe('Transfer Pricing Summit');
  });
});

describe('normalizeEventTitle ordinals', () => {
  it('lower-cases ordinal suffixes', () => {
    expect(normalizeEventTitle('SEMINAR ON 57TH GST COUNCIL MEETING')).toBe('Seminar on 57th GST Council Meeting');
  });
});
