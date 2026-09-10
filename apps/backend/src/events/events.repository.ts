import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { EventDto } from '@shared/event';
import { generateUniqueSlug } from '../common/slugify';

// Every column aliased to its EventDto camelCase name — the query already produces the exact DTO
// shape, so there's no separate Row type to hand-maintain here. Shared by every method below since
// none of them need a narrower projection.
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
  'status',
  'createdAt:created_at',
  'updatedAt:updated_at',
] as const;

@Injectable()
export class EventsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findUpcomingPublished(sinceIso: string): Promise<EventDto[]> {
    const { data, error } = await this.supabase.db
      .from('events')
      .select(EVENT_COLUMNS.join(', '))
      .eq('status', 'published')
      .or(`end_date.gte.${sinceIso},and(end_date.is.null,start_date.gte.${sinceIso})`)
      .order('start_date', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }

  async findAllPublished(): Promise<EventDto[]> {
    const { data, error } = await this.supabase.db
      .from('events')
      .select(EVENT_COLUMNS.join(', '))
      .eq('status', 'published')
      .order('start_date', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }

  async findAllForAdmin(): Promise<EventDto[]> {
    const { data, error } = await this.supabase.db
      .from('events')
      .select(EVENT_COLUMNS.join(', '))
      .order('start_date', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }

  async findByIdForAdmin(id: string): Promise<EventDto> {
    const { data, error } = await this.supabase.db
      .from('events')
      .select(EVENT_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load event.');
    if (!data) throw new NotFoundException('Event not found.');
    return data as unknown as EventDto;
  }

  async findUniqueSlug(title: string): Promise<string> {
    return generateUniqueSlug(this.supabase.db, 'events', title, 'event');
  }

  async insert(row: Record<string, unknown>): Promise<EventDto> {
    const { data: inserted, error } = await this.supabase.db
      .from('events')
      .insert(row)
      .select(EVENT_COLUMNS.join(', '))
      .single();

    if (error || !inserted) throw new InternalServerErrorException('Failed to create event.');
    return inserted as unknown as EventDto;
  }

  async updateById(id: string, patch: Record<string, unknown>): Promise<EventDto> {
    const { data: updated, error } = await this.supabase.db
      .from('events')
      .update(patch)
      .eq('id', id)
      .select(EVENT_COLUMNS.join(', '))
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to update event.');
    return updated as unknown as EventDto;
  }

  // One round trip instead of a separate findByIdForAdmin() 404-check followed by the delete —
  // `.select().maybeSingle()` on the delete itself returns the deleted row (or null) so a missing
  // id and an actual delete failure stay distinguishable without a second query.
  async deleteById(id: string): Promise<void> {
    const { data, error } = await this.supabase.db.from('events').delete().eq('id', id).select('id').maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to delete event.');
    if (!data) throw new NotFoundException('Event not found.');
  }
}
