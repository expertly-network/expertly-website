// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MAX_ARTICLE_WORDS, MIN_ARTICLE_WORDS, countArticleWords } from './word-count';

describe('countArticleWords', () => {
  it('keeps a word boundary between adjacent block elements', () => {
    expect(countArticleWords('<h2>Tax tips</h2><p>File early, file often.</p>')).toBe(6);
    expect(countArticleWords('<ul><li>One</li><li>Two</li></ul>line<br>break')).toBe(4);
  });

  it('counts words, not markup', () => {
    expect(countArticleWords('<p>File <strong>early</strong>, <em>file</em> often.</p>')).toBe(4);
  });

  it('returns 0 for empty or tag-only HTML', () => {
    expect(countArticleWords('')).toBe(0);
    expect(countArticleWords('<p>   </p><br>')).toBe(0);
  });

  it('collapses any whitespace between words', () => {
    expect(countArticleWords('<p>one\n\ttwo   three</p>')).toBe(3);
  });

  it('parses into an inert document: no image fetch, no inline handler runs', () => {
    const handler = vi.fn();
    (window as unknown as { __pwned: () => void }).__pwned = handler;
    expect(countArticleWords('<img src="https://evil.example/x.png" onerror="window.__pwned()"><p>safe text</p>')).toBe(
      2
    );
    expect(handler).not.toHaveBeenCalled();
    expect(document.querySelectorAll('img')).toHaveLength(0);
  });

  it('mirrors the backend range', () => {
    expect([MIN_ARTICLE_WORDS, MAX_ARTICLE_WORDS]).toEqual([800, 2000]);
  });
});
