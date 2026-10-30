import { describe, expect, it } from 'vitest';
import { sanitizeArticleBody } from './sanitize-article-body';

const REL = 'noopener noreferrer nofollow';

describe('sanitizeArticleBody', () => {
  it('keeps the allowed formatting tags', () => {
    const html =
      '<h2>Title</h2><p><strong>b</strong> <em>i</em> <u>u</u> <code>c</code></p><ul><li>x</li></ul><blockquote>q</blockquote>';
    expect(sanitizeArticleBody(html)).toBe(html);
  });

  it.each([
    ['<p>a</p><script>alert(1)</script>', '<p>a</p>'],
    ['<style>body{display:none}</style><p>a</p>', '<p>a</p>'],
    ['<iframe src="https://evil.com"></iframe><p>a</p>', '<p>a</p>'],
    ['<img src=x onerror="alert(1)"><p>a</p>', '<p>a</p>'],
    ['<p onclick="alert(1)" style="color:red" class="x">a</p>', '<p>a</p>'],
    ['<svg><script>alert(1)</script></svg><p>a</p>', '<p>a</p>'],
  ])('strips dangerous markup: %s', (input, expected) => {
    expect(sanitizeArticleBody(input)).toBe(expected);
  });

  it.each([
    'javascript:alert(1)',
    'JAVASCRIPT:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD4=',
    'http://insecure.com',
    '//evil.com/x',
    'vbscript:msgbox(1)',
  ])('drops a non-https href %j', (href) => {
    const out = sanitizeArticleBody(`<p><a href="${href}">x</a></p>`);
    expect(out).not.toContain('href');
    expect(out).toBe(`<p><a rel="${REL}">x</a></p>`);
  });

  it('keeps https links and forces rel', () => {
    expect(sanitizeArticleBody('<a href="https://firm.com" rel="opener">x</a>')).toBe(
      `<a href="https://firm.com" rel="${REL}">x</a>`
    );
  });

  it('keeps target=_blank only as _blank, always with the fixed rel', () => {
    expect(sanitizeArticleBody('<a href="https://firm.com" target="_blank">x</a>')).toBe(
      `<a href="https://firm.com" target="_blank" rel="${REL}">x</a>`
    );
    expect(sanitizeArticleBody('<a href="https://firm.com" target="_parent">x</a>')).toBe(
      `<a href="https://firm.com" rel="${REL}">x</a>`
    );
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeArticleBody('  <p>a</p>\n')).toBe('<p>a</p>');
  });
});
