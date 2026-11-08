// Parses an article's sanitized HTML body into a small typed tree, so renderers that can't take
// raw HTML (the article PDF) lay it out the same way the published page does. The input is
// already limited by the backend's sanitize-article-body.ts to p, h2, h3, ul, ol, li, blockquote,
// strong, em, u, code, pre, a and br; anything else is unwrapped to its text. Browser-only: it
// uses DOMParser.

export interface InlineRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  href?: string;
}

export interface ListItem {
  inlines: InlineRun[];
  /** Lists nested inside this item. */
  lists: ListBlock[];
}

export interface ListBlock {
  kind: 'list';
  ordered: boolean;
  items: ListItem[];
}

export type ArticleBlock =
  | { kind: 'p' | 'h2' | 'h3'; inlines: InlineRun[] }
  | ListBlock
  | { kind: 'blockquote'; blocks: ArticleBlock[] }
  | { kind: 'pre'; text: string };

type Marks = Omit<InlineRun, 'text'>;

const BLOCK_TAGS = new Set(['P', 'H2', 'H3', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'H1', 'H4', 'H5', 'H6', 'DIV']);

function inlineRuns(nodes: Iterable<Node>, marks: Marks = {}): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\s+/g, ' ');
      if (text) runs.push({ text, ...marks });
      continue;
    }
    if (!(node instanceof Element)) continue;
    const tag = node.tagName;
    if (tag === 'BR') {
      runs.push({ text: '\n', ...marks });
      continue;
    }
    const next: Marks = { ...marks };
    if (tag === 'STRONG' || tag === 'B') next.bold = true;
    if (tag === 'EM' || tag === 'I') next.italic = true;
    if (tag === 'U') next.underline = true;
    if (tag === 'CODE') next.code = true;
    if (tag === 'A') {
      const href = node.getAttribute('href');
      if (href && /^(https?:|mailto:)/i.test(href)) next.href = href;
    }
    runs.push(...inlineRuns(node.childNodes, next));
  }
  return runs;
}

// Trims the whitespace a block's markup leaves at its edges ("<p> Hello </p>", newlines around a
// <br>), merges adjacent runs with identical marks, and drops a block that ends up empty.
function tidy(runs: InlineRun[]): InlineRun[] {
  const merged: InlineRun[] = [];
  for (const run of runs) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.bold === run.bold &&
      prev.italic === run.italic &&
      prev.underline === run.underline &&
      prev.code === run.code &&
      prev.href === run.href
    ) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }
  for (const run of merged) run.text = run.text.replace(/ *\n */g, '\n');
  if (merged.length) {
    merged[0].text = merged[0].text.replace(/^\s+/, '');
    const last = merged[merged.length - 1];
    last.text = last.text.replace(/\s+$/, '');
  }
  return merged.filter((run) => run.text.length > 0);
}

function listBlock(el: Element): ListBlock {
  const items: ListItem[] = [];
  for (const li of Array.from(el.children)) {
    if (li.tagName !== 'LI') continue;
    const inlineNodes: Node[] = [];
    const lists: ListBlock[] = [];
    for (const child of Array.from(li.childNodes)) {
      if (child instanceof Element && (child.tagName === 'UL' || child.tagName === 'OL')) {
        lists.push(listBlock(child));
      } else if (child instanceof Element && child.tagName === 'P') {
        // Tiptap wraps each list item's text in <p>; consecutive ones become separate lines.
        if (inlineNodes.length) inlineNodes.push(li.ownerDocument.createElement('br'));
        inlineNodes.push(...Array.from(child.childNodes));
      } else {
        inlineNodes.push(child);
      }
    }
    items.push({ inlines: tidy(inlineRuns(inlineNodes)), lists });
  }
  return { kind: 'list', ordered: el.tagName === 'OL', items };
}

function blocksOf(nodes: Iterable<Node>): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  let loose: Node[] = [];
  // Inline content sitting directly in the body or a blockquote becomes its own paragraph.
  const flushLoose = () => {
    const inlines = tidy(inlineRuns(loose));
    if (inlines.length) blocks.push({ kind: 'p', inlines });
    loose = [];
  };
  for (const node of nodes) {
    if (!(node instanceof Element) || !BLOCK_TAGS.has(node.tagName)) {
      loose.push(node);
      continue;
    }
    flushLoose();
    const tag = node.tagName;
    if (tag === 'UL' || tag === 'OL') {
      blocks.push(listBlock(node));
    } else if (tag === 'BLOCKQUOTE') {
      const inner = blocksOf(node.childNodes);
      if (inner.length) blocks.push({ kind: 'blockquote', blocks: inner });
    } else if (tag === 'PRE') {
      const text = (node.textContent ?? '').replace(/\n+$/, '');
      if (text.trim()) blocks.push({ kind: 'pre', text });
    } else if (tag === 'DIV') {
      blocks.push(...blocksOf(node.childNodes));
    } else {
      const kind = tag === 'H2' || tag === 'H1' ? 'h2' : tag === 'P' ? 'p' : 'h3';
      const inlines = tidy(inlineRuns(node.childNodes));
      if (inlines.length) blocks.push({ kind, inlines });
    }
  }
  flushLoose();
  return blocks;
}

export function parseArticleHtml(html: string): ArticleBlock[] {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  return blocksOf(doc.body.childNodes);
}
