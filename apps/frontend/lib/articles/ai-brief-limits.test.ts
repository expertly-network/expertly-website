import { describe, expect, it } from 'vitest';
import { AI_BRIEF_LIMITS, countWords, parseSourceLinks, wordLimitError } from './ai-brief-limits';

describe('wordLimitError', () => {
  it('rejects a near-empty brief like "ABC"', () => {
    expect(wordLimitError('ABC', AI_BRIEF_LIMITS.notes, 'your thoughts')).toMatch(/at least 25 words/);
  });
  it('accepts text within bounds', () => {
    expect(wordLimitError('word '.repeat(30), AI_BRIEF_LIMITS.notes, 'x')).toBeNull();
  });
  it('rejects text over the maximum', () => {
    expect(wordLimitError('word '.repeat(601), AI_BRIEF_LIMITS.notes, 'x')).toMatch(/600 words/);
  });
  it('allows an empty optional field', () => {
    expect(wordLimitError('', AI_BRIEF_LIMITS.recentDevelopments, 'x')).toBeNull();
  });
  it('counts words on whitespace', () => {
    expect(countWords('  a  b\nc ')).toBe(3);
  });
});

describe('parseSourceLinks', () => {
  it('accepts full http(s) links and blank lines', () => {
    expect(parseSourceLinks('https://a.com/x\n\nhttp://b.org')).toEqual({
      links: ['https://a.com/x', 'http://b.org'],
      error: null,
    });
  });
  it('rejects a bare word or missing scheme', () => {
    expect(parseSourceLinks('www.example.com').error).toMatch(/isn't a valid link/);
    expect(parseSourceLinks('hello').error).toMatch(/isn't a valid link/);
  });
  it('rejects non-web schemes and more than five links', () => {
    expect(parseSourceLinks('ftp://a.com').error).toMatch(/isn't a valid link/);
    expect(parseSourceLinks(Array(6).fill('https://a.com').join('\n')).error).toMatch(/at most 5/);
  });
});
