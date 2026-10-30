import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../auth/supabase.service';
import type { ArticleSource, DocType, EventSource, MemberSource, SearchCard } from './card.types';
import type {
  Applied,
  ArticleSearchResult,
  EventSearchResult,
  Hit,
  MemberSearchResult,
  Plan,
  SearchResult,
} from './search.types';

// A failed search-table read/write (500 SEARCH_DB_ERROR).
function searchDbError(message: string): InternalServerErrorException {
  return new InternalServerErrorException({ code: 'SEARCH_DB_ERROR', message });
}

export interface PendingEmbeddingRow {
  id: number;
  doc_type: DocType;
  title: string;
  content: string;
  content_hash: string;
}

export interface OutboxJob {
  id: number;
  doc_type: DocType;
  source_id: string;
  // Opaque string: never convert to Date — completeOutbox must send back the exact microsecond-precision value (JS Date truncates to ms and the claim match would fail).
  claimed_at: string;
}

const MEMBER_COLUMNS = [
  'profile_id',
  'status',
  'slug',
  'headline',
  'firm_name',
  'city',
  'state',
  'country',
  'years_of_experience',
  'bio',
  'work_experiences',
  'educations',
  'engagements',
  'key_clients',
  'qualifications',
  'credentials',
  'awards',
  'availability_notes',
  'rate_min_cents',
  'rate_max_cents',
  'is_available',
  'membership_started_at',
  'created_at',
] as const;

const ARTICLE_COLUMNS = [
  'id',
  'status',
  'title',
  'author_id',
  'service_ids',
  'custom_service_labels',
  'countries',
  'state',
  'ai_summary',
  'excerpt',
  'body',
  'created_at',
] as const;

const EVENT_COLUMNS = [
  'id',
  'status',
  'title',
  'event_type',
  'event_format',
  'organiser_name',
  'venue_name',
  'city',
  'country',
  'start_date',
  'end_date',
  'is_free',
  'short_description',
  'description',
] as const;

interface MemberServiceRow {
  service_id: string;
  custom_label: string | null;
  services:
    | { name: string; categories: { name: string } | { name: string }[] }
    | { name: string; categories: { name: string } | { name: string }[] }[];
}

/**
 * All Supabase access for search. The search_* tables/functions are in database.types.ts, but
 * this class still goes through one untyped client accessor and the hand-written row interfaces
 * above: rpc() and readRows() take the function/table name as a runtime string, and Plan/Applied
 * aren't `Json`-typed. TODO(types): give rpc() a `keyof Functions` signature and drop `client()`.
 */
@Injectable()
export class SearchRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private client(): SupabaseClient {
    return this.supabase.db as unknown as SupabaseClient;
  }

  private documents() {
    return this.client().from('search_documents');
  }

  // The message keeps the DB detail on purpose: it feeds search_outbox.last_error and the logs.
  // HttpExceptionFilter never returns a 5xx message to the client.
  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client().rpc(fn, args);
    if (error) throw searchDbError(`${fn} failed: ${error.message}`);
    return data as T;
  }

  // ---- embeddings ---------------------------------------------------------------------

  /** Documents whose card text changed since they were last embedded (oldest first). */
  pendingEmbeddings(limit: number): Promise<PendingEmbeddingRow[]> {
    return this.rpc<PendingEmbeddingRow[] | null>('search_pending_embeddings', { p_limit: limit }).then(
      (rows) => rows ?? []
    );
  }

  /**
   * Stores an embedding (passed as the text '[0.1,0.2,…]'). Returns false if the card changed
   * while embedding (stale write rejected) — it is picked up again on the next run.
   */
  storeEmbedding(id: number, hash: string, embedding: number[], model: string): Promise<boolean> {
    return this.rpc<boolean>('search_store_embedding', {
      p_id: id,
      p_hash: hash,
      p_embedding: `[${embedding.join(',')}]`,
      p_model: model,
    });
  }

  // ---- source records for the card builder (read-only) --------------------------------

  async loadMemberSource(profileId: string): Promise<MemberSource | null> {
    // All three reads key on the profile id — run them together rather than one after another.
    const [profileRes, personRes, linksRes] = await Promise.all([
      this.client().from('member_profiles').select(MEMBER_COLUMNS.join(', ')).eq('profile_id', profileId).maybeSingle(),
      this.client()
        .from('profiles')
        .select('first_name, last_name, status, deleted_at')
        .eq('id', profileId)
        .maybeSingle(),
      this.client()
        .from('member_services')
        .select('service_id, custom_label, services!inner(name, categories!inner(name))')
        .eq('member_id', profileId),
    ]);
    if (profileRes.error) throw searchDbError(`member_profiles read failed: ${profileRes.error.message}`);
    if (!profileRes.data) return null;
    if (personRes.error) throw searchDbError(`profiles read failed: ${personRes.error.message}`);
    if (linksRes.error) throw searchDbError(`member_services read failed: ${linksRes.error.message}`);
    const profile = profileRes.data;
    const person = personRes.data;
    const links = linksRes.data;

    const one = <T>(v: T | T[]): T => (Array.isArray(v) ? v[0] : v);
    return {
      profile: profile as unknown as MemberSource['profile'],
      person: (person as MemberSource['person']) ?? null,
      services: ((links ?? []) as unknown as MemberServiceRow[]).map((l) => {
        const svc = one(l.services);
        return {
          service_id: l.service_id,
          custom_label: l.custom_label,
          service_name: svc.name,
          category_name: one(svc.categories).name,
        };
      }),
    };
  }

  async loadArticleSource(id: string): Promise<ArticleSource | null> {
    const { data, error } = await this.client()
      .from('articles')
      .select(ARTICLE_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();
    if (error) throw searchDbError(`articles read failed: ${error.message}`);
    if (!data) return null;
    const article = data as unknown as ArticleSource['article'] & { author_id: string };

    // Author and service names both hang off the article row only — fetch them together.
    const [authorRes, servicesRes] = await Promise.all([
      this.client().from('profiles').select('first_name, last_name').eq('id', article.author_id).maybeSingle(),
      article.service_ids.length > 0
        ? this.client().from('services').select('name').in('id', article.service_ids)
        : Promise.resolve({ data: [] as { name: string }[], error: null }),
    ]);
    if (authorRes.error) throw searchDbError(`profiles read failed: ${authorRes.error.message}`);
    if (servicesRes.error) throw searchDbError(`services read failed: ${servicesRes.error.message}`);
    const author = authorRes.data;
    const serviceNames = ((servicesRes.data ?? []) as { name: string }[]).map((s) => s.name);
    return { article, author: (author as ArticleSource['author']) ?? null, serviceNames };
  }

  async loadEventSource(id: string): Promise<EventSource | null> {
    const { data, error } = await this.client()
      .from('events')
      .select(EVENT_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();
    if (error) throw searchDbError(`events read failed: ${error.message}`);
    return (data as unknown as EventSource) ?? null;
  }

  // ---- search_documents ---------------------------------------------------------------

  /** Port of search_put's upsert. WRITES — only the outbox worker calls this. */
  async upsertDocument(card: SearchCard): Promise<void> {
    const { error } = await this.documents().upsert(
      {
        doc_type: card.docType,
        source_id: card.sourceId,
        chunk_index: 0,
        title: card.title,
        search_name: card.searchName,
        content: card.content,
        content_hash: card.contentHash,
        service_ids: card.serviceIds,
        countries: card.countries,
        city: card.city,
        event_start: card.eventStart,
        event_end: card.eventEnd,
        rate_min_cents: card.rateMinCents,
        rate_max_cents: card.rateMaxCents,
        is_available: card.isAvailable,
        doc_date: card.docDate,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'doc_type,source_id,chunk_index' }
    );
    if (error) throw searchDbError(`search_documents upsert failed: ${error.message}`);
  }

  async deleteDocument(docType: DocType, sourceId: string): Promise<void> {
    const { error } = await this.documents().delete().eq('doc_type', docType).eq('source_id', sourceId);
    if (error) throw searchDbError(`search_documents delete failed: ${error.message}`);
  }

  // ---- outbox -------------------------------------------------------------------------

  claimOutbox(limit: number): Promise<OutboxJob[]> {
    return this.rpc<OutboxJob[] | null>('search_outbox_claim', { p_limit: limit }).then((rows) => rows ?? []);
  }

  async completeOutbox(job: OutboxJob, error: string | null): Promise<void> {
    await this.rpc<null>('search_outbox_complete', { p_id: job.id, p_claimed_at: job.claimed_at, p_error: error });
  }

  // ---- query path ---------------------------------------------------------------------

  /** Practice-area phrase -> service ids (search_match_services). */
  matchServices(text: string, limit: number): Promise<{ service_id: string; score: number }[]> {
    return this.rpc<{ service_id: string; score: number }[] | null>('search_match_services', {
      p_text: text,
      p_limit: limit,
    }).then((rows) => rows ?? []);
  }

  hybrid(args: {
    query: string | null;
    embedding: string | null;
    docTypes: DocType[];
    serviceIds: string[] | null;
    countries: string[] | null;
    city: string | null;
    dateFrom: string | null;
    dateTo: string | null;
    rateMaxCents: number | null;
    limit: number;
    minSimilarity: number;
  }): Promise<Hit[]> {
    return this.rpc<Hit[] | null>('search_hybrid', {
      p_query: args.query,
      p_embedding: args.embedding,
      p_doc_types: args.docTypes,
      p_countries: args.countries,
      p_date_from: args.dateFrom,
      p_date_to: args.dateTo,
      p_rate_max_cents: args.rateMaxCents,
      p_limit: args.limit,
      p_min_similarity: args.minSimilarity,
      p_service_ids: args.serviceIds,
      p_city: args.city,
    }).then((rows) => rows ?? []);
  }

  /** Public display fields only — never contact details. */
  async hydrate(hits: Hit[]): Promise<SearchResult[]> {
    const ids = (t: DocType) => hits.filter((h) => h.doc_type === t).map((h) => h.source_id);
    const memberIds = ids('member');
    const articleIds = ids('article');
    const eventIds = ids('event');

    const [members, memberServices, articles, events] = await Promise.all([
      memberIds.length
        ? this.readRows<MemberRow>('member_profiles', HYDRATE_MEMBER_COLUMNS, 'profile_id', memberIds)
        : [],
      memberIds.length
        ? this.readRows<MemberServiceNameRow>('member_services', 'member_id, services(name)', 'member_id', memberIds)
        : [],
      articleIds.length ? this.readRows<ArticleRow>('articles', HYDRATE_ARTICLE_COLUMNS, 'id', articleIds) : [],
      eventIds.length ? this.readRows<EventRow>('events', HYDRATE_EVENT_COLUMNS, 'id', eventIds) : [],
    ]);

    const services = new Map<string, string[]>();
    for (const row of memberServices) {
      const svc = Array.isArray(row.services) ? row.services[0] : row.services;
      const name = svc?.name;
      if (!name || name.toLowerCase().startsWith('other (please')) continue;
      services.set(row.member_id, [...(services.get(row.member_id) ?? []), name]);
    }
    const memberMap = new Map(members.map((r) => [r.profile_id, r]));
    const articleMap = new Map(articles.map((r) => [r.id, r]));
    const eventMap = new Map(events.map((r) => [r.id, r]));

    // Re-checked live, not trusted from the card: a member deactivated or an article/event
    // unpublished since its card was last rebuilt (the worker may lag or be down) is dropped.
    const out: SearchResult[] = [];
    for (const h of hits) {
      if (h.doc_type === 'member') {
        const r = memberMap.get(h.source_id);
        if (!r || r.status !== 'active') continue;
        const member: MemberSearchResult = {
          type: 'member',
          id: h.source_id,
          name: h.title,
          slug: r.slug,
          headline: r.headline,
          firm: r.firm_name,
          location: [r.city, r.country].filter(Boolean).join(', '),
          services: services.get(h.source_id) ?? [],
          available: r.is_available,
          rate:
            r.rate_min_cents != null || r.rate_max_cents != null
              ? { minCents: r.rate_min_cents, maxCents: r.rate_max_cents, currency: r.rate_currency }
              : null,
        };
        out.push(member);
      } else if (h.doc_type === 'article') {
        const r = articleMap.get(h.source_id);
        if (!r || r.status !== 'published') continue;
        const article: ArticleSearchResult = {
          type: 'article',
          id: h.source_id,
          title: r.title,
          slug: r.slug,
          excerpt: (r.excerpt ?? '').slice(0, 300),
          countries: r.countries,
          publishedAt: r.created_at,
          readTimeMinutes: r.read_time_minutes,
        };
        out.push(article);
      } else {
        const r = eventMap.get(h.source_id);
        if (!r || r.status !== 'published') continue;
        const event: EventSearchResult = {
          type: 'event',
          id: h.source_id,
          title: r.title,
          slug: r.slug,
          summary: r.short_description,
          startsAt: r.start_date,
          endsAt: r.end_date,
          location: [r.city, r.country].filter(Boolean).join(', '),
          format: r.event_format,
          isFree: r.is_free,
          registrationUrl: r.registration_url,
        };
        out.push(event);
      }
    }
    return out;
  }

  private async readRows<T>(table: string, columns: string, idColumn: string, ids: string[]): Promise<T[]> {
    const { data, error } = await this.client().from(table).select(columns).in(idColumn, ids);
    if (error) throw searchDbError(`${table} read failed: ${error.message}`);
    return (data ?? []) as unknown as T[];
  }

  /** Card text for the judge, keyed `${doc_type}:${source_id}`. */
  async cardContents(sourceIds: string[]): Promise<Map<string, string>> {
    const { data, error } = await this.documents().select('doc_type, source_id, content').in('source_id', sourceIds);
    if (error) throw searchDbError(`search_documents read failed: ${error.message}`);
    const cards = new Map<string, string>();
    for (const c of (data ?? []) as { doc_type: string; source_id: string; content: string }[]) {
      cards.set(`${c.doc_type}:${c.source_id}`, c.content);
    }
    return cards;
  }

  // ---- housekeeping (port of search_housekeeping) --------------------------------------

  /** Deletes processed outbox notes older than `before`; returns the number removed. */
  async deleteProcessedOutboxBefore(before: Date): Promise<number> {
    const { data, error } = await this.client()
      .from('search_outbox')
      .delete()
      .lt('processed_at', before.toISOString())
      .select('id');
    if (error) throw searchDbError(`search_outbox cleanup failed: ${error.message}`);
    return (data ?? []).length;
  }

  /** Deletes query log rows older than `before`; returns the number removed. */
  async deleteQueryLogsBefore(before: Date): Promise<number> {
    const { data, error } = await this.client()
      .from('search_query_log')
      .delete()
      .lt('created_at', before.toISOString())
      .select('id');
    if (error) throw searchDbError(`search_query_log cleanup failed: ${error.message}`);
    return (data ?? []).length;
  }

  // ---- query log ----------------------------------------------------------------------

  /** Returns the new row's id. Callers treat a throw as non-fatal: logging must never break a search. */
  async insertQueryLog(row: {
    userId: string;
    question: string;
    plan: Plan;
    applied: Applied;
    resultRefs: { type: string; id: string; title: string }[];
    answer: string;
    degraded: string[];
    ms: number;
  }): Promise<string | null> {
    const { data, error } = await this.client()
      .from('search_query_log')
      .insert({
        user_id: row.userId,
        source: 'user',
        question: row.question,
        plan: row.plan,
        applied: row.applied,
        result_refs: row.resultRefs,
        answer: row.answer,
        degraded: row.degraded,
        ms: row.ms,
      })
      .select('id')
      .single();
    if (error) throw searchDbError(`search_query_log insert failed: ${error.message}`);
    return (data as { id: string } | null)?.id ?? null;
  }

  /** Scoped to the user's own log row. Returns false if the update failed. */
  async setFeedback(logId: string, userId: string, rating: 1 | -1, note: string | null): Promise<boolean> {
    const { error } = await this.client()
      .from('search_query_log')
      .update({ feedback: rating, feedback_note: note })
      .eq('id', logId)
      .eq('user_id', userId);
    return !error;
  }
}

const HYDRATE_MEMBER_COLUMNS =
  'profile_id,status,slug,headline,firm_name,city,country,is_available,rate_min_cents,rate_max_cents,rate_currency';
const HYDRATE_ARTICLE_COLUMNS = 'id,status,slug,title,excerpt,countries,created_at,read_time_minutes';
const HYDRATE_EVENT_COLUMNS =
  'id,status,slug,title,short_description,start_date,end_date,city,country,event_format,is_free,registration_url';

interface MemberRow {
  profile_id: string;
  status: string;
  slug: string;
  headline: string | null;
  firm_name: string | null;
  city: string | null;
  country: string;
  is_available: boolean;
  rate_min_cents: number | null;
  rate_max_cents: number | null;
  rate_currency: string;
}
interface MemberServiceNameRow {
  member_id: string;
  services: { name: string } | { name: string }[] | null;
}
interface ArticleRow {
  id: string;
  status: string;
  slug: string;
  title: string;
  excerpt: string | null;
  countries: string[];
  created_at: string;
  read_time_minutes: number;
}
interface EventRow {
  id: string;
  status: string;
  slug: string;
  title: string;
  short_description: string | null;
  start_date: string;
  end_date: string | null;
  city: string | null;
  country: string | null;
  event_format: string | null;
  is_free: boolean;
  registration_url: string | null;
}
