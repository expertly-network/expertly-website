import sanitizeHtml from 'sanitize-html';

// The range POST/PATCH /v1/articles enforces (ArticlesService.assertWordCount) whenever the
// resulting status isn't 'draft'. Shared with AiService so a generated/refined draft can be
// corrected against the exact same bounds before it ever reaches that check.
export const MIN_ARTICLE_WORDS = 400;
export const MAX_ARTICLE_WORDS = 2000;

// Strips HTML tags, leaving plain text.
export function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
}

export function countArticleWords(body: string): number {
  return stripHtml(body).trim().split(/\s+/).filter(Boolean).length;
}
