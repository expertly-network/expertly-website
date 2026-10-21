// Mirrors MIN_ARTICLE_WORDS / MAX_ARTICLE_WORDS in apps/backend/src/articles/word-count.ts — the
// same 800–2000 range applies to manual and AI-drafted articles (the backend enforces it on
// publish/submit; these are for live feedback before that).
export const MIN_ARTICLE_WORDS = 800;
export const MAX_ARTICLE_WORDS = 2000;

// Strips HTML tags before counting so markup doesn't inflate the count. Browser-only.
export function countArticleWords(html: string): number {
  if (typeof document === 'undefined') return 0;
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div.textContent ?? '').trim();
  return text ? text.split(/\s+/).length : 0;
}
