import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';
import type { EventDto } from '@shared/event';
import { generateUniqueSlug } from '../common/slugify';

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
  'status',
  'createdAt:created_at',
  'updatedAt:updated_at',
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
      .order('start_date', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }

  async findAllPublished(): Promise<EventDto[]> {
    const { data, error } = await this.events()
      .select(EVENT_COLUMNS.join(', '))
      .eq('status', 'published')
      .order('start_date', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }

  async findAllForAdmin(): Promise<EventDto[]> {
    const { data, error } = await this.events()
      .select(EVENT_COLUMNS.join(', '))
      .order('start_date', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load events.');
    return data as unknown as EventDto[];
  }

  async findByIdForAdmin(id: string): Promise<EventDto> {
    const { data, error } = await this.events()
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

  async insert(row: EventInsert): Promise<EventDto> {
    const { data: inserted, error } = await this.events()
      .insert(row)
      .select(EVENT_COLUMNS.join(', '))
      .single();

    if (error || !inserted) throw new InternalServerErrorException('Failed to create event.');
    return inserted as unknown as EventDto;
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
    if (!data) throw new NotFoundException('Event not found.');
  }
}
