import sanitizeHtml from 'sanitize-html';

// Allowed tags and attributes for article body HTML. Links are https-only, and every link gets
// a fixed rel (no reverse-tabnabbing, no SEO credit for member-inserted links) — an author's own
// rel value is never kept.
export const ARTICLE_BODY_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'strong', 'em', 'u', 'code', 'pre', 'a', 'br'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['https'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...(attribs.href ? { href: attribs.href } : {}),
        ...(attribs.target === '_blank' ? { target: '_blank' } : {}),
        rel: 'noopener noreferrer nofollow',
      },
    }),
  },
};

export function sanitizeArticleBody(html: string): string {
  return sanitizeHtml(html, ARTICLE_BODY_SANITIZE_OPTIONS).trim();
}
