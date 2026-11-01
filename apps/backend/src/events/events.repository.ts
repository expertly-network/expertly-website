import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { keywordOrFilter } from './keyword-search';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';
import type { EventDto, CalendarEventDto } from '@shared/event';
import { generateUniqueSlug, generateUniqueSlugs, isSlugUniqueViolation, SlugTakenException } from '../common/slugify';
import { MAX_LIST_ROWS } from '../common/list-limits';

export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type EventUpdate = Database['public']['Tables']['events']['Update'];

// Every column aliased to its EventDto camelCase name.
const EVENT_COLUMNS = [
  'id',
  'title',
  'slug',
  'description',
  'shortDescription:short_description',
  'coverImageUrl:cover_image_url',
  'startDate:start_date',
  'endDate:end_date',
  'timezone',
  'eventType:event_type',
  'eventFormat:event_format',
  'country',
  'city',
  'venueName:venue_name',
  'isFree:is_free',
  'registrationUrl:registration_url',
  'organiserName:organiser_name',
  'categoryIds:category_ids',
  'status',
  'createdAt:created_at',
  'updatedAt:updated_at',
] as const;

// The lean shape the calendar grid and date-picker dots need — no description or links.
const CALENDAR_COLUMNS = [
  'id',
  'title',
  'startDate:start_date',
  'endDate:end_date',
  'country',
  'eventFormat:event_format',
] as const;

@Injectable()
export class EventsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private events() {
    return this.supabase.db.from('events');
  }

  async findUpcomingPublished(sinceIso: string): Promise<EventDto[]> {
    const { data, error } = await this.events()
      .select(EVENT_COLUMNS.join(', '))
      .eq('status', 'published')
      .or(`end_date.gte.${sinceIso},and(end_date.is.null,start_date.gte.${sinceIso})`)
      .order('start_date', { ascending: true })
      .limit(MAX_LIST_ROWS);

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }

  // One page of published events (past and upcoming) overlapping [fromIso, toExclusiveIso), oldest
  // first, plus the total across all pages. Times are server-generated ISO strings, not user text.
  async findPublishedPage(
    filters: {
      fromIso?: string;
      /** Starting on or after this instant (an event already running before it is excluded). */
      startFromIso?: string;
      toExclusiveIso?: string;
      countries?: string[];
      formats?: string[];
      types?: string[];
      terms?: string[];
      /** Tagged with any of these categories; an empty list matches nothing. */
      categoryIds?: string[];
    },
    range: { from: number; to: number }
  ): Promise<{ rows: EventDto[]; total: number }> {
    let query = this.events().select(EVENT_COLUMNS.join(', '), { count: 'exact' }).eq('status', 'published');
    if (filters.fromIso) {
      query = query.or(`end_date.gte.${filters.fromIso},and(end_date.is.null,start_date.gte.${filters.fromIso})`);
    }
    if (filters.startFromIso) query = query.gte('start_date', filters.startFromIso);
    if (filters.toExclusiveIso) query = query.lt('start_date', filters.toExclusiveIso);
    if (filters.countries?.length) query = query.in('country', filters.countries);
    if (filters.formats?.length) query = query.in('event_format', filters.formats);
    if (filters.types?.length) query = query.in('event_type', filters.types);
    if (filters.categoryIds) {
      // An empty list means the taxonomy filter matched no categories, so no event can match.
      if (filters.categoryIds.length === 0) query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      else query = query.overlaps('category_ids', filters.categoryIds);
    }
    // Each keyword must match some searched column; terms are pre-sanitised (keyword-search.ts).
    for (const term of filters.terms ?? []) query = query.or(keywordOrFilter(term));
    const { data, error, count } = await query
      .order('start_date', { ascending: true })
      .order('id', { ascending: true })
      .range(range.from, range.to);

    if (error) throw new InternalServerErrorException('Failed to load events.');
    const rows = data as unknown as EventDto[];
    return { rows, total: count ?? rows.length };
  }

  // Start/end of every published event overlapping the span, for the date picker's per-day dots.
  // Read in PostgREST-sized chunks (max_rows is 1000) so a busy span isn't silently truncated.
  async findPublishedSpans(fromIso: string, toExclusiveIso: string): Promise<CalendarEventDto[]> {
    const CHUNK = 1000;
    const spans: CalendarEventDto[] = [];
    for (let offset = 0; ; offset += CHUNK) {
      const { data, error } = await this.events()
        .select(CALENDAR_COLUMNS.join(', '))
        .eq('status', 'published')
        .or(`end_date.gte.${fromIso},and(end_date.is.null,start_date.gte.${fromIso})`)
        .lt('start_date', toExclusiveIso)
        .order('start_date', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + CHUNK - 1);
      if (error) throw new InternalServerErrorException('Failed to load event days.');
      const rows = data as unknown as CalendarEventDto[];
      spans.push(...rows);
      if (rows.length < CHUNK) break;
    }
    return spans;
  }

  // Uncapped on purpose: feeds the admin list AND the CSV export/import round trip, which must
  // see every event (events are admin-created, so the table grows only with admin work).
  async findAllForAdmin(): Promise<EventDto[]> {
    const { data, error } = await this.events()
      .select(EVENT_COLUMNS.join(', '))
      .order('start_date', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }

  async findByIdForAdmin(id: string): Promise<EventDto> {
    const { data, error } = await this.events().select(EVENT_COLUMNS.join(', ')).eq('id', id).maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load event.');
    if (!data) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    return data as unknown as EventDto;
  }

  async findUniqueSlug(title: string): Promise<string> {
    return generateUniqueSlug(this.supabase.db, 'events', title, 'event');
  }

  // One slug per title, unique against the table and each other, in one existence query.
  async findUniqueSlugs(titles: string[]): Promise<string[]> {
    return generateUniqueSlugs(this.supabase.db, 'events', titles, 'event');
  }

  // Throws SlugTakenException when a concurrent insert took the slug (callers retry).
  async insert(row: EventInsert): Promise<EventDto> {
    const { data: inserted, error } = await this.events().insert(row).select(EVENT_COLUMNS.join(', ')).single();

    if (isSlugUniqueViolation(error)) throw new SlugTakenException('EVENT_SLUG_TAKEN', 'Event slug already exists.');
    if (error || !inserted) throw new InternalServerErrorException('Failed to create event.');
    return inserted as unknown as EventDto;
  }

  // Single multi-row insert — one network/DB round trip rather than one per row.
  async bulkInsert(rows: EventInsert[]): Promise<EventDto[]> {
    if (rows.length === 0) return [];

    const { data: inserted, error } = await this.events().insert(rows).select(EVENT_COLUMNS.join(', '));

    if (isSlugUniqueViolation(error)) throw new SlugTakenException('EVENT_SLUG_TAKEN', 'Event slug already exists.');
    if (error || !inserted) throw new InternalServerErrorException('Failed to create events.');
    return inserted as unknown as EventDto[];
  }

  async updateById(id: string, patch: EventUpdate): Promise<EventDto> {
    const { data: updated, error } = await this.events()
      .update(patch)
      .eq('id', id)
      .select(EVENT_COLUMNS.join(', '))
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to update event.');
    return updated as unknown as EventDto;
  }

  // Returns the deleted row so a missing id and a delete failure stay distinguishable.
  async deleteById(id: string): Promise<void> {
    const { data, error } = await this.events().delete().eq('id', id).select('id').maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to delete event.');
    if (!data) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
  }

  // Single multi-row delete, used by the bulk import's full-sync pass. Caller already knows
  // every id exists (they came from a prior findAllForAdmin() call), so no NotFoundException path.
  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const { error } = await this.events().delete().in('id', ids);
    if (error) throw new InternalServerErrorException('Failed to delete events.');
  }
}
