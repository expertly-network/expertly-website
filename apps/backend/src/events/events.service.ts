import { BadRequestException, Injectable } from '@nestjs/common';
import { CategoriesService } from '../categories/categories.service';
import { inferEventCategoryIds } from './event-categories';
import { keywordTerms } from './keyword-search';
import type {
  CalendarEventDto,
  EventCalendarResponse,
  EventDaysResponse,
  EventDto,
  EventOrganiserDto,
  EventStatsResponse,
  ImportEventsResponse,
  ImportEventsRowResultDto,
} from '@shared/event';
import { EVENT_CALENDAR_MAX_DAYS, EVENT_CALENDAR_PER_DAY } from '@shared/event';
import { EVENTS_PAGE_SIZE_DEFAULT } from '@shared/event';
import { EventDaysQueryDto, ListEventsQueryDto } from './dto/list-events-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAY_SPAN = 400;

// Midnight UTC of an ISO date (YYYY-MM-DD…), and of the day after it.
function utcDayStart(isoDate: string): Date {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
}
function utcDayAfter(isoDate: string): Date {
  return new Date(utcDayStart(isoDate).getTime() + DAY_MS);
}
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { assertPublishReady } from './publish-requirements';
import { EventsRepository, type EventInsert, type EventUpdate } from './events.repository';
import { withUniqueSlugRetry } from '../common/slugify';
import { eventsToCsv, parseEventsCsv } from './events-csv';
import { toEventColumns, validateEventRow, type ValidatedEventRow } from './import-events';

@Injectable()
export class EventsService {
  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly categoriesService: CategoriesService
  ) {}

  private async categoryLookup(): Promise<{ idByName: Map<string, string>; lineById: Map<string, string> }> {
    const categories = await this.categoriesService.list();
    return {
      idByName: new Map(categories.map((c) => [c.name, c.id])),
      lineById: new Map(categories.map((c) => [c.id, c.serviceLineId])),
    };
  }

  // categoryIds is an array column with no FK — every id must be a real, active category.
  private async assertCategoryIds(ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return unique;
    const { lineById } = await this.categoryLookup();
    if (unique.some((id) => !lineById.has(id))) {
      throw new BadRequestException({ code: 'EVENT_CATEGORY_INVALID', message: 'Unknown event category.' });
    }
    return unique;
  }

  // The taxonomy filters as one category-id list: explicit categories, narrowed to (or replaced
  // by) the categories of the chosen service lines. Undefined = no taxonomy filter.
  private async resolveCategoryFilter(query: ListEventsQueryDto): Promise<string[] | undefined> {
    if (!query.categoryId?.length && !query.serviceLineId?.length) return undefined;
    const { lineById } = await this.categoryLookup();
    let ids = query.categoryId?.length ? query.categoryId : [...lineById.keys()];
    if (query.serviceLineId?.length) {
      const lines = new Set(query.serviceLineId);
      ids = ids.filter((id) => lines.has(lineById.get(id) ?? ''));
    }
    return ids;
  }

  // Upcoming, published events, soonest first.
  async listUpcoming(): Promise<EventDto[]> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    return this.eventsRepository.findUpcomingPublished(startOfToday.toISOString());
  }

  // Published events past and upcoming, filtered and paged on the server (see ListEventsQueryDto).
  async listPublished(query: ListEventsQueryDto): Promise<{ items: EventDto[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? EVENTS_PAGE_SIZE_DEFAULT;
    if (query.from && query.to && query.to < query.from) {
      throw new BadRequestException({ code: 'EVENT_RANGE_INVALID', message: '`to` must not be before `from`.' });
    }
    const { rows, total } = await this.eventsRepository.findPublishedPage(
      {
        fromIso: query.from ? utcDayStart(query.from).toISOString() : undefined,
        startFromIso: query.startFrom ? utcDayStart(query.startFrom).toISOString() : undefined,
        toExclusiveIso: query.to ? utcDayAfter(query.to).toISOString() : undefined,
        countries: query.country,
        formats: query.format,
        types: query.type,
        organisers: query.organiser,
        terms: query.q ? keywordTerms(query.q) : undefined,
        categoryIds: await this.resolveCategoryFilter(query),
      },
      { from: (page - 1) * pageSize, to: page * pageSize - 1 }
    );
    return { items: rows, total };
  }

  // Every organiser with a published event, most events first (ties by name) — the organiser
  // filter's options. Names are trimmed for counting but returned as stored, so they match `organiser`.
  async listOrganisers(): Promise<EventOrganiserDto[]> {
    const counts = new Map<string, number>();
    for (const { organiserName } of await this.eventsRepository.findPublishedFacets()) {
      if (!organiserName?.trim()) continue;
      counts.set(organiserName, (counts.get(organiserName) ?? 0) + 1);
    }
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }

  // The events page sidebar's figures, over published events that haven't ended yet (same
  // "upcoming" as the page's default filter: still running today or later).
  async getStats(): Promise<EventStatsResponse> {
    const startOfToday = new Date();
    startOfToday.setUTCHours(0, 0, 0, 0);
    const rows = await this.eventsRepository.findPublishedFacets(startOfToday.toISOString());
    const distinct = (values: (string | null)[]) =>
      new Set(values.map((v) => v?.trim().toLowerCase()).filter((v): v is string => !!v)).size;
    return {
      upcoming: rows.length,
      countries: distinct(rows.map((r) => r.country)),
      organisers: distinct(rows.map((r) => r.organiserName)),
    };
  }

  // Days (UTC, YYYY-MM-DD) with at least one published event in [from, to] — the picker's dots.
  async listEventDays(query: EventDaysQueryDto): Promise<EventDaysResponse> {
    const from = utcDayStart(query.from);
    const toExclusive = utcDayAfter(query.to);
    const spanDays = (toExclusive.getTime() - from.getTime()) / DAY_MS;
    if (spanDays <= 0 || spanDays > MAX_DAY_SPAN) {
      throw new BadRequestException({
        code: 'EVENT_RANGE_INVALID',
        message: `\`to\` must be on or after \`from\`, at most ${MAX_DAY_SPAN} days later.`,
      });
    }
    const spans = await this.eventsRepository.findPublishedSpans(from.toISOString(), toExclusive.toISOString());
    const days = new Set<string>();
    for (const span of spans) {
      const start = utcDayStart(span.startDate.slice(0, 10));
      const end = utcDayStart((span.endDate ?? span.startDate).slice(0, 10));
      // Only the part of the event inside the requested span; bounded so a bad end date can't loop long.
      const first = start < from ? from : start;
      for (let d = first, i = 0; d <= end && d < toExclusive && i <= MAX_DAY_SPAN; i++) {
        days.add(d.toISOString().slice(0, 10));
        d = new Date(d.getTime() + DAY_MS);
      }
    }
    return { days: [...days].sort() };
  }

  // Per UTC day in [from, to] (at most EVENT_CALENDAR_MAX_DAYS): the number of published events
  // running that day and EVENT_CALENDAR_PER_DAY of them (those starting that day first) — all the home calendar draws,
  // so a busy month costs a few KB instead of every event with its description.
  async listCalendar(query: EventDaysQueryDto): Promise<EventCalendarResponse> {
    const from = utcDayStart(query.from);
    const toExclusive = utcDayAfter(query.to);
    const spanDays = (toExclusive.getTime() - from.getTime()) / DAY_MS;
    if (spanDays <= 0 || spanDays > EVENT_CALENDAR_MAX_DAYS) {
      throw new BadRequestException({
        code: 'EVENT_RANGE_INVALID',
        message: `\`to\` must be on or after \`from\`, at most ${EVENT_CALENDAR_MAX_DAYS} days later.`,
      });
    }
    // Earliest start first (the repository orders by start_date, id).
    const events = await this.eventsRepository.findPublishedSpans(from.toISOString(), toExclusive.toISOString());
    // Per day: events that start that day come first (earliest first), then ones already running —
    // otherwise a month-long course would fill the same two slots on every day it spans.
    const byDay = new Map<string, { starting: CalendarEventDto[]; ongoing: CalendarEventDto[] }>();
    for (const event of events) {
      const start = utcDayStart(event.startDate.slice(0, 10));
      const end = utcDayStart((event.endDate ?? event.startDate).slice(0, 10));
      const first = start < from ? from : start;
      for (let d = first, i = 0; d <= end && d < toExclusive && i <= EVENT_CALENDAR_MAX_DAYS; i++) {
        const key = d.toISOString().slice(0, 10);
        const day = byDay.get(key) ?? { starting: [], ongoing: [] };
        (d.getTime() === start.getTime() ? day.starting : day.ongoing).push(event);
        byDay.set(key, day);
        d = new Date(d.getTime() + DAY_MS);
      }
    }
    return {
      days: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, day]) => ({
          date,
          count: day.starting.length + day.ongoing.length,
          events: [...day.starting, ...day.ongoing].slice(0, EVENT_CALENDAR_PER_DAY),
        })),
    };
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
    // No categories given → inferred from the title/description (see event-categories.ts).
    const categoryIds =
      dto.categoryIds !== undefined
        ? await this.assertCategoryIds(dto.categoryIds)
        : inferEventCategoryIds(dto.title, dto.description, (await this.categoryLookup()).idByName);

    return withUniqueSlugRetry(
      () => this.eventsRepository.findUniqueSlug(dto.title),
      (slug) =>
        this.eventsRepository.insert({
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
          category_ids: categoryIds,
          status: dto.status ?? 'draft',
        })
    );
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
    if (dto.categoryIds !== undefined) patch.category_ids = await this.assertCategoryIds(dto.categoryIds);

    return this.eventsRepository.updateById(id, patch);
  }

  async remove(id: string): Promise<void> {
    return this.eventsRepository.deleteById(id);
  }

  async exportToCsv(): Promise<string> {
    const [events, categories] = await Promise.all([
      this.eventsRepository.findAllForAdmin(),
      this.categoriesService.list(),
    ]);
    return eventsToCsv(events, new Map(categories.map((c) => [c.id, c.name])));
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
      throw new BadRequestException({
        code: 'CSV_NO_ROWS',
        message:
          'CSV has no event rows. Refusing to run — a full sync would delete every existing event. ' +
          'If that is really the goal, delete events individually instead.',
      });
    }

    const [existing, { idByName }] = await Promise.all([
      this.eventsRepository.findAllForAdmin(),
      this.categoryLookup(),
    ]);
    const existingById = new Map(existing.map((event) => [event.id, event]));

    const errors: string[] = [];
    const seenIds = new Set<string>();
    const toCreate: ValidatedEventRow[] = [];
    const toUpdate: ValidatedEventRow[] = [];

    for (const row of rows) {
      const result = validateEventRow(row, idByName);
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
      // Slugs for every new row in one batched lookup; regenerated together if the insert loses a
      // slug race to a concurrent create.
      const created = await withUniqueSlugRetry(
        () => this.eventsRepository.findUniqueSlugs(toCreate.map((row) => row.title)),
        (slugs) =>
          this.eventsRepository.bulkInsert(
            toCreate.map((row, index): EventInsert => ({ ...toEventColumns(row), slug: slugs[index] }))
          )
      );
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
