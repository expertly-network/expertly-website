import { describe, expect, it } from 'vitest';
import { countArticleWords, stripHtml } from './word-count';

describe('countArticleWords', () => {
  it('keeps a word boundary between adjacent block elements', () => {
    expect(countArticleWords('<h2>Tax tips</h2><p>File early, file often.</p>')).toBe(6);
    expect(countArticleWords('<ul><li>One</li><li>Two</li></ul>line<br>break')).toBe(4);
  });

  it('does not split words around inline markup', () => {
    expect(countArticleWords('<p>un<strong>believ</strong>able results</p>')).toBe(2);
  });

  it('ignores markup-only and empty bodies', () => {
    expect(countArticleWords('')).toBe(0);
    expect(countArticleWords('<p></p><br>')).toBe(0);
  });
});

describe('stripHtml', () => {
  it('drops every tag and leaves readable text', () => {
    expect(stripHtml('<h2>Title</h2><p>Body <a href="https://x.test">link</a></p>').replace(/\s+/g, ' ').trim()).toBe(
      'Title Body link'
    );
  });
});
