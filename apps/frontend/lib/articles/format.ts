export function formatArticleDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
    .toUpperCase();
}

export function formatReadTime(minutes: number): string {
  return `${minutes} min read`;
}

// The author card's "designation" line under their name.
export function formatAuthorDesignation(headline: string | null, firmName: string | null): string {
  return [headline, firmName].filter(Boolean).join(', ');
}
