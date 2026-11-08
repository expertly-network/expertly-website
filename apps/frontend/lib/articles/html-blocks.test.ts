// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseArticleHtml } from './html-blocks';

describe('parseArticleHtml', () => {
  it('maps headings and paragraphs with inline marks', () => {
    expect(parseArticleHtml('<h2>Intro</h2><p> Hello <strong>bold</strong> and <em>soft</em> </p>')).toEqual([
      { kind: 'h2', inlines: [{ text: 'Intro' }] },
      {
        kind: 'p',
        inlines: [{ text: 'Hello ' }, { text: 'bold', bold: true }, { text: ' and ' }, { text: 'soft', italic: true }],
      },
    ]);
  });

  it('keeps only http(s)/mailto links and turns <br> into line breaks', () => {
    expect(
      parseArticleHtml('<p><a href="https://x.test">site</a><br>\n<a href="javascript:alert(1)">bad</a></p>')
    ).toEqual([{ kind: 'p', inlines: [{ text: 'site', href: 'https://x.test' }, { text: '\nbad' }] }]);
  });

  it('parses lists, including Tiptap <p>-wrapped items and nested lists', () => {
    expect(parseArticleHtml('<ol><li><p>One</p><ul><li>Sub</li></ul></li><li>Two</li></ol>')).toEqual([
      {
        kind: 'list',
        ordered: true,
        items: [
          {
            inlines: [{ text: 'One' }],
            lists: [{ kind: 'list', ordered: false, items: [{ inlines: [{ text: 'Sub' }], lists: [] }] }],
          },
          { inlines: [{ text: 'Two' }], lists: [] },
        ],
      },
    ]);
  });

  it('parses blockquotes and code blocks, and drops empty blocks', () => {
    expect(parseArticleHtml('<blockquote><p>Quote</p></blockquote><p> </p><pre><code>a\n  b\n</code></pre>')).toEqual([
      { kind: 'blockquote', blocks: [{ kind: 'p', inlines: [{ text: 'Quote' }] }] },
      { kind: 'pre', text: 'a\n  b' },
    ]);
  });

  it('wraps loose top-level text in a paragraph', () => {
    expect(parseArticleHtml('Plain <u>text</u>')).toEqual([
      { kind: 'p', inlines: [{ text: 'Plain ' }, { text: 'text', underline: true }] },
    ]);
  });
});
