// Shared article display formatting — used by the homepage's Latest Articles section and,
// once built, the Articles list/detail pages (Task 4/5), so the date/read-time treatment
// doesn't drift between them.

export function formatArticleDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    .toUpperCase();
}

export function formatReadTime(minutes: number): string {
  return `${minutes} min read`;
}

// Matches design/static_html/articles.html's `[title, firm].filter(Boolean).join(', ')` —
// the author card's "designation" line under their name. Either half can be null (a member
// hasn't set a headline/firm yet); an empty string means render nothing.
export function formatAuthorDesignation(headline: string | null, firmName: string | null): string {
  return [headline, firmName].filter(Boolean).join(', ');
}
