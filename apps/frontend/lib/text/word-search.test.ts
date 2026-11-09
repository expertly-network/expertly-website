import { describe, expect, it } from 'vitest';
import { matchesWords, queryWords } from './word-search';

const texts: Record<string, string> = {
  privacy: 'Legal Data Protection, Technology & IP Data Protection & Privacy',
  maTax: 'Tax Direct Tax M&A / Transaction Tax',
  fundTax: 'Tax Direct Tax Fund & Investment Management Tax',
  mergers: 'Legal Corporate, M&A & Capital Markets Mergers & Acquisitions',
  corpTax: 'Tax Direct Tax Corporate Income tax / Federal Tax',
};

const match = (query: string) => Object.keys(texts).filter((k) => matchesWords(texts[k] as string, queryWords(query)));

describe('word search', () => {
  it('matches words in any order, not just as one phrase', () => {
    expect(match('corporate tax')).toEqual(['corpTax']);
    expect(match('federal corporate')).toEqual(['corpTax']);
    expect(match('direct corporate')).toEqual(['corpTax']);
  });

  it('finds a word that follows a spaced "&"', () => {
    expect(match('privacy')).toEqual(['privacy']);
    expect(match('acquisitions')).toEqual(['mergers']);
    expect(match('investment')).toEqual(['fundTax']);
  });

  it('finds words before a spaced "&"', () => {
    expect(match('protection')).toEqual(['privacy']);
    expect(match('ip')).toEqual(['privacy']);
  });

  it('keeps "&" phrases precise', () => {
    expect(match('m&a tax')).toEqual(['maTax']);
    expect(match('protection & privacy')).toEqual(['privacy']);
    expect(match('data & privacy')).toEqual([]);
  });

  it('matches "M&A" without the ampersand', () => {
    expect(match('ma tax')).toContain('maTax');
  });

  it('matches everything on an empty or symbols-only query', () => {
    expect(match('  ')).toHaveLength(Object.keys(texts).length);
    expect(match('&')).toHaveLength(Object.keys(texts).length);
  });

  it('handles an "&" next to punctuation', () => {
    const text = 'Beneficial Ownership (UBO) & KYC Filings';
    expect(matchesWords(text, queryWords('kyc'))).toBe(true);
    expect(matchesWords(text, queryWords('(ubo) & kyc'))).toBe(true);
    expect(matchesWords(text, queryWords('kyc &'))).toBe(true);
  });
});
