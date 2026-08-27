export type EventFormat = 'in_person' | 'virtual' | 'hybrid';
export type EventStatus = 'draft' | 'published';

// Matches supabase/migrations/0004_tables.sql's `events` table. No separate list-item type
// (unlike ArticleListItemDto/ArticleDto) — `description` isn't a heavy field the way an
// article's `body` is, so there's nothing to omit for a browse/list view.
export interface EventDto {
  id: string;
  title: string;
  slug: string;
  description: string;
  shortDescription: string | null;
  coverImageUrl: string | null;
  startDate: string;
  endDate: string | null;
  timezone: string | null;
  eventType: string | null;
  eventFormat: EventFormat | null;
  country: string | null;
  city: string | null;
  venueName: string | null;
  isFree: boolean;
  registrationUrl: string | null;
  organiserName: string | null;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}
