import { formatDate } from '@/lib/dates';

export function formatArticleDate(iso: string): string {
  return formatDate(iso);
}

export function formatReadTime(minutes: number): string {
  return `${minutes} min read`;
}

// The author card's "designation" line under their name.
export function formatAuthorDesignation(headline: string | null, firmName: string | null): string {
  return [headline, firmName].filter(Boolean).join(', ');
}

// The "AI Summary" callout's takeaways — one per non-blank line of `aiSummary`. Shared by the
// article page and the article PDF.
export function aiSummaryPoints(summary: string | null): string[] {
  return (
    summary
      ?.split('\n')
      .map((p) => p.trim())
      .filter(Boolean) ?? []
  );
}

// Closes every article — on the page and in the PDF.
export const ARTICLE_LEGAL_DISCLAIMER =
  'The views expressed in this article are those of the author and do not constitute legal, tax, or financial advice. This content is published for informational purposes only. Readers should seek independent professional advice before acting on any information contained herein.';
