import type { JsonValue } from './card-text';

export type DocType = 'member' | 'article' | 'event';

/** One search_documents row as the card builder produces it (chunk_index is always 0). */
export interface SearchCard {
  docType: DocType;
  sourceId: string;
  title: string;
  searchName: string;
  content: string;
  contentHash: string;
  serviceIds: string[];
  countries: string[];
  city: string | null;
  eventStart: string | null;
  eventEnd: string | null;
  rateMinCents: number | null;
  rateMaxCents: number | null;
  isAvailable: boolean | null;
  docDate: string;
}

export interface MemberSource {
  profile: {
    profile_id: string;
    status: string;
    slug: string;
    headline: string | null;
    firm_name: string | null;
    city: string | null;
    state: string | null;
    country: string;
    years_of_experience: number | null;
    bio: string | null;
    work_experiences: JsonValue;
    educations: JsonValue;
    engagements: JsonValue;
    key_clients: JsonValue;
    qualifications: JsonValue;
    credentials: JsonValue;
    awards: JsonValue;
    availability_notes: string | null;
    rate_min_cents: number | null;
    rate_max_cents: number | null;
    is_available: boolean;
    membership_started_at: string | null;
    created_at: string;
  };
  person: { first_name: string | null; last_name: string | null; status: string; deleted_at: string | null } | null;
  services: { service_id: string; custom_label: string | null; service_name: string; category_name: string }[];
}

export interface ArticleSource {
  article: {
    id: string;
    status: string;
    title: string;
    service_ids: string[];
    custom_service_labels: JsonValue;
    countries: string[];
    state: string | null;
    ai_summary: string | null;
    excerpt: string | null;
    body: string | null;
    created_at: string;
  };
  author: { first_name: string | null; last_name: string | null } | null;
  /** names of services in article.service_ids */
  serviceNames: string[];
}

export interface EventSource {
  id: string;
  status: string;
  title: string;
  event_type: string | null;
  event_format: string | null;
  organiser_name: string | null;
  venue_name: string | null;
  city: string | null;
  country: string | null;
  start_date: string;
  end_date: string | null;
  is_free: boolean;
  short_description: string | null;
  description: string | null;
}

/** null from a builder means "no card should exist" — delete the document. */
export type CardResult = SearchCard | null;
