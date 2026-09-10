import { Injectable } from '@nestjs/common';
import type { EventDto } from '@shared/event';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { assertPublishReady } from './publish-requirements';
import { EventsRepository } from './events.repository';

@Injectable()
export class EventsService {
  constructor(private readonly repository: EventsRepository) {}

  // Upcoming, published events — the only shape a caller needs today (the homepage's
  // Upcoming Events section). Ordered soonest-first. A future Events-page session can extend
  // this with pagination/past-events params once that page actually exists.
  async listUpcoming(): Promise<EventDto[]> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    return this.repository.findUpcomingPublished(startOfToday.toISOString());
  }

  // Every published event, past or future, soonest-first among the full set
  async listAll(): Promise<EventDto[]> {
    return this.repository.findAllPublished();
  }

  // Every event regardless of status, ordered the same way the public browse list is
  // (chronological by start_date) — backs the admin list at /admin/events, which needs to show
  // drafts too, unlike listAll() above.
  async adminList(): Promise<EventDto[]> {
    return this.repository.findAllForAdmin();
  }

  // Single event, any status — backs the admin edit page's prefill. No public equivalent exists:
  // GET /v1/events never needed a by-id shape.
  async adminGetOne(id: string): Promise<EventDto> {
    return this.repository.findByIdForAdmin(id);
  }

  async create(dto: CreateEventDto): Promise<EventDto> {
    const status = dto.status ?? 'draft';
    if (status === 'published') assertPublishReady(dto as unknown as Record<string, unknown>);

    const slug = await this.repository.findUniqueSlug(dto.title);

    return this.repository.insert({
      slug,
      title: dto.title,
      description: dto.description,
      short_description: dto.shortDescription ?? null,
      cover_image_url: dto.coverImageUrl ?? null,
      start_date: dto.startDate,
      end_date: dto.endDate ?? null,
      timezone: dto.timezone ?? null,
      event_type: dto.eventType ?? null,
      event_format: dto.eventFormat ?? null,
      country: dto.country ?? null,
      city: dto.city ?? null,
      venue_name: dto.venueName ?? null,
      is_free: dto.isFree ?? false,
      registration_url: dto.registrationUrl ?? null,
      organiser_name: dto.organiserName ?? null,
      // Matches the column's own default — see CreateEventDto.status's comment.
      status: dto.status ?? 'draft',
    });
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventDto> {
    const current = await this.repository.findByIdForAdmin(id); // 404s if missing before attempting the patch

    // Resolved against the merged (patch-over-current) fields, not just this PATCH body — a
    // status-less PATCH on an already-published event (e.g. {city: ''}) must not be able to
    // sneak a required field back out to blank, and publishing a draft via {status:'published'}
    // needs to see fields the draft already had, not just what's in this particular request.
    const status = dto.status ?? current.status;
    if (status === 'published') {
      assertPublishReady({
        title: dto.title !== undefined ? dto.title : current.title,
        organiserName: dto.organiserName !== undefined ? dto.organiserName : current.organiserName,
        description: dto.description !== undefined ? dto.description : current.description,
        startDate: dto.startDate !== undefined ? dto.startDate : current.startDate,
        endDate: dto.endDate !== undefined ? dto.endDate : current.endDate,
        eventFormat: dto.eventFormat !== undefined ? dto.eventFormat : current.eventFormat,
        eventType: dto.eventType !== undefined ? dto.eventType : current.eventType,
        city: dto.city !== undefined ? dto.city : current.city,
        country: dto.country !== undefined ? dto.country : current.country,
        registrationUrl: dto.registrationUrl !== undefined ? dto.registrationUrl : current.registrationUrl,
      });
    }

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.shortDescription !== undefined) patch.short_description = dto.shortDescription;
    if (dto.coverImageUrl !== undefined) patch.cover_image_url = dto.coverImageUrl;
    if (dto.startDate !== undefined) patch.start_date = dto.startDate;
    if (dto.endDate !== undefined) patch.end_date = dto.endDate;
    if (dto.timezone !== undefined) patch.timezone = dto.timezone;
    if (dto.eventType !== undefined) patch.event_type = dto.eventType;
    if (dto.eventFormat !== undefined) patch.event_format = dto.eventFormat;
    if (dto.country !== undefined) patch.country = dto.country;
    if (dto.city !== undefined) patch.city = dto.city;
    if (dto.venueName !== undefined) patch.venue_name = dto.venueName;
    if (dto.isFree !== undefined) patch.is_free = dto.isFree;
    if (dto.registrationUrl !== undefined) patch.registration_url = dto.registrationUrl;
    if (dto.organiserName !== undefined) patch.organiser_name = dto.organiserName;
    if (dto.status !== undefined) patch.status = dto.status;

    return this.repository.updateById(id, patch);
  }

  async remove(id: string): Promise<void> {
    return this.repository.deleteById(id);
  }
}
