import sanitizeHtml from 'sanitize-html';

// The range POST/PATCH /v1/articles enforces (ArticlesService.assertWordCount) whenever the
// resulting status isn't 'draft'. Shared with AiService so a generated/refined draft can be
// corrected against the exact same bounds before it ever reaches that check. 800 is the documented
// rule (docs/rest-api.md, the design's "Minimum 800 words" copy) for manual AND AI articles alike —
// it had drifted to 400, which let ~600-word AI drafts publish while manual ones were held to 800.
export const MIN_ARTICLE_WORDS = 800;
export const MAX_ARTICLE_WORDS = 2000;
// Upper bound on a body's raw HTML length — far above 2,000 words of markup, but it stops a
// megabyte-sized body (drafts skip the word check) from being stored or sent to the AI.
export const MAX_ARTICLE_BODY_LENGTH = 100_000;

// Strips HTML tags, leaving plain text.
export function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
}

export function countArticleWords(body: string): number {
  return stripHtml(body).trim().split(/\s+/).filter(Boolean).length;
}
