import { BadRequestException, Injectable } from '@nestjs/common';
import type { EventDto, ImportEventsResponse, ImportEventsRowResultDto } from '@shared/event';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { assertPublishReady } from './publish-requirements';
import { EventsRepository, type EventInsert, type EventUpdate } from './events.repository';
import { eventsToCsv, parseEventsCsv } from './events-csv';
import { toEventColumns, validateEventRow, type ValidatedEventRow } from './import-events';

@Injectable()
export class EventsService {
  constructor(private readonly eventsRepository: EventsRepository) {}

  // Upcoming, published events, soonest first.
  async listUpcoming(): Promise<EventDto[]> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    return this.eventsRepository.findUpcomingPublished(startOfToday.toISOString());
  }

  // Every published event, soonest first.
  async listAll(): Promise<EventDto[]> {
    return this.eventsRepository.findAllPublished();
  }

  // Every event regardless of status.
  async adminList(): Promise<EventDto[]> {
    return this.eventsRepository.findAllForAdmin();
  }

  async adminGetOne(id: string): Promise<EventDto> {
    return this.eventsRepository.findByIdForAdmin(id);
  }

  async create(dto: CreateEventDto): Promise<EventDto> {
    const status = dto.status ?? 'draft';
    if (status === 'published') assertPublishReady(dto as unknown as Record<string, unknown>);

    const slug = await this.eventsRepository.findUniqueSlug(dto.title);

    return this.eventsRepository.insert({
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
      status: dto.status ?? 'draft',
    });
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventDto> {
    const current = await this.eventsRepository.findByIdForAdmin(id);

    // Checked against the merged (patch-over-current) fields, not just this request body.
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

    const patch: EventUpdate = {};
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

    return this.eventsRepository.updateById(id, patch);
  }

  async remove(id: string): Promise<void> {
    return this.eventsRepository.deleteById(id);
  }

  async exportToCsv(): Promise<string> {
    const events = await this.eventsRepository.findAllForAdmin();
    return eventsToCsv(events);
  }

  // All-or-nothing full sync: every row is validated before anything is written: a blank `id`
  // creates, a filled `id` matching an existing event fully replaces it, and any existing event
  // whose id isn't present anywhere in the file is deleted. See the design note in this
  // session's history for why this isn't wrapped in a single DB transaction — rows are fully
  // pre-validated, so a write-phase failure is a rare infra issue, not a data problem, and at
  // this table's scale (dozens of rows) re-running the import is a sufficient recovery path.
  async importFromCsv(buffer: Buffer): Promise<ImportEventsResponse> {
    const { rows, headerErrors } = parseEventsCsv(buffer);
    if (headerErrors.length > 0) throw new BadRequestException(headerErrors);
    if (rows.length === 0) {
      throw new BadRequestException(
        'CSV has no event rows. Refusing to run — a full sync would delete every existing event. ' +
          'If that is really the goal, delete events individually instead.'
      );
    }

    const existing = await this.eventsRepository.findAllForAdmin();
    const existingById = new Map(existing.map((event) => [event.id, event]));

    const errors: string[] = [];
    const seenIds = new Set<string>();
    const toCreate: ValidatedEventRow[] = [];
    const toUpdate: ValidatedEventRow[] = [];

    for (const row of rows) {
      const result = validateEventRow(row);
      if ('errors' in result) {
        errors.push(...result.errors);
        continue;
      }

      const { id } = result.row;
      if (id === null) {
        toCreate.push(result.row);
        continue;
      }
      if (seenIds.has(id)) {
        errors.push(`Row ${row.rowNumber}: id "${id}" is used by more than one row in this file.`);
        continue;
      }
      if (!existingById.has(id)) {
        errors.push(`Row ${row.rowNumber}: id "${id}" does not match any existing event.`);
        continue;
      }
      seenIds.add(id);
      toUpdate.push(result.row);
    }

    if (errors.length > 0) throw new BadRequestException(errors);

    const results: ImportEventsRowResultDto[] = [];

    if (toCreate.length > 0) {
      const usedSlugs = new Set<string>();
      const inserts: EventInsert[] = [];
      for (const row of toCreate) {
        const slug = await this.eventsRepository.findUniqueSlug(row.title, usedSlugs);
        inserts.push({ ...toEventColumns(row), slug });
      }

      const created = await this.eventsRepository.bulkInsert(inserts);
      created.forEach((event, index) => {
        results.push({ row: toCreate[index].rowNumber, action: 'created', id: event.id, title: event.title });
      });
    }

    for (const row of toUpdate) {
      const updated = await this.eventsRepository.updateById(row.id as string, toEventColumns(row));
      results.push({ row: row.rowNumber, action: 'updated', id: updated.id, title: updated.title });
    }

    const deleteIds = existing.filter((event) => !seenIds.has(event.id)).map((event) => event.id);
    if (deleteIds.length > 0) {
      await this.eventsRepository.deleteByIds(deleteIds);
      for (const id of deleteIds) {
        const event = existingById.get(id) as EventDto;
        results.push({ row: null, action: 'deleted', id: event.id, title: event.title });
      }
    }

    return {
      createdCount: toCreate.length,
      updatedCount: toUpdate.length,
      deletedCount: deleteIds.length,
      results,
    };
  }
}
