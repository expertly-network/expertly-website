// Mirrors MIN_ARTICLE_WORDS / MAX_ARTICLE_WORDS in apps/backend/src/articles/word-count.ts — the
// same 800–2000 range applies to manual and AI-drafted articles (the backend enforces it on
// publish/submit; these are for live feedback before that).
export const MIN_ARTICLE_WORDS = 800;
export const MAX_ARTICLE_WORDS = 2000;

const BLOCK_TAG =
  /<\/?(?:p|div|h[1-6]|li|ul|ol|blockquote|pre|br|hr|tr|td|th|table|figure|figcaption|section|article)\b[^>]*>/gi;

// Strips HTML tags before counting so markup doesn't inflate the count. Browser-only. Parsed into
// an inert DOMParser document, never the live one: `innerHTML` on a live element fetches <img src>
// and runs inline handlers (onerror=...) of whatever HTML it's handed, e.g. a pasted or AI draft.
export function countArticleWords(html: string): number {
  if (typeof DOMParser === 'undefined') return 0;
  // A space before each block-level/line-break tag keeps a word boundary between blocks, or
  // `<h2>Tax tips</h2><p>File early</p>` reads as "Tax tipsFile early". Mirrors the backend's
  // stripHtml (apps/backend/src/articles/word-count.ts) so both counts agree.
  const spaced = html.replace(BLOCK_TAG, ' $&');
  const doc = new DOMParser().parseFromString(spaced, 'text/html');
  const text = (doc.body.textContent ?? '').trim();
  return text ? text.split(/\s+/).length : 0;
}
