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
