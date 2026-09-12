import sanitizeHtml from 'sanitize-html';

// Allowed tags and attributes for article body HTML.
export const ARTICLE_BODY_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'u', 'code', 'pre', 'a', 'br'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['https'],
};

export function sanitizeArticleBody(html: string): string {
  return sanitizeHtml(html, ARTICLE_BODY_SANITIZE_OPTIONS).trim();
}
