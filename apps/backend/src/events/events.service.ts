import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { EventDto } from '@shared/event';

const SELECT_COLUMNS =
  'id, title, slug, description, shortDescription:short_description, coverImageUrl:cover_image_url, ' +
  'startDate:start_date, endDate:end_date, timezone, eventType:event_type, eventFormat:event_format, ' +
  'country, city, venueName:venue_name, isFree:is_free, registrationUrl:registration_url, ' +
  'organiserName:organiser_name, status, createdAt:created_at, updatedAt:updated_at';

@Injectable()
export class EventsService {
  constructor(private readonly supabase: SupabaseService) {}

  // Upcoming, published events — the only shape a caller needs today (the homepage's
  // Upcoming Events section). Ordered soonest-first. A future Events-page session can extend
  // this with pagination/past-events params once that page actually exists.
  //
  // "Upcoming" is measured against the start of today (UTC), not the exact current
  // timestamp — comparing against `now()` would exclude an event whose `start_date` is
  // midnight today just because it's now later in the day. A multi-day event already
  // underway (started before today, `end_date` still today or later) still counts as
  // upcoming/ongoing; a single-day event with no `end_date` only needs its `start_date` to
  // not have passed.
  async listUpcoming(): Promise<EventDto[]> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const todayIso = startOfToday.toISOString();

    const { data, error } = await this.supabase.db
      .from('events')
      .select(SELECT_COLUMNS)
      .eq('status', 'published')
      .or(`end_date.gte.${todayIso},and(end_date.is.null,start_date.gte.${todayIso})`)
      .order('start_date', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }

  // Every published event, past or future, soonest-first among the full set — backs the
  // standalone /events page's month-grouped browse list (design/static_html/events.html),
  // which itself doesn't distinguish past/upcoming visually, just groups everything
  // chronologically. Unlike listUpcoming(), no date filter at all.
  async listAll(): Promise<EventDto[]> {
    const { data, error } = await this.supabase.db
      .from('events')
      .select(SELECT_COLUMNS)
      .eq('status', 'published')
      .order('start_date', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }
}
