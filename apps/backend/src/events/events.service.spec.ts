import { describe, expect, it, vi } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repository';
import type { CategoriesService } from '../categories/categories.service';
import { EventDaysQueryDto, ListEventsQueryDto } from './dto/list-events-query.dto';

function setup() {
  const repository = Object.assign(Object.create(EventsRepository.prototype) as EventsRepository, {
    findPublishedPage: vi.fn().mockResolvedValue({ rows: [], total: 1649 }),
    findPublishedSpans: vi.fn().mockResolvedValue([
      { startDate: '2026-11-29T09:00:00Z', endDate: '2026-12-02T18:00:00Z' },
      { startDate: '2026-12-02T10:00:00Z', endDate: null },
      { startDate: '2026-12-04T10:00:00Z', endDate: null },
    ]),
  });
  const categories = {
    list: vi.fn().mockResolvedValue([
      { id: 'cat-gst', name: 'Indirect Tax', serviceLineId: 'line-tax' },
      { id: 'cat-dt', name: 'Direct Tax', serviceLineId: 'line-tax' },
      { id: 'cat-arb', name: 'Dispute Resolution & Investigations', serviceLineId: 'line-legal' },
    ]),
  } as unknown as CategoriesService;
  return { repository, service: new EventsService(repository, categories) };
}

describe('public event browsing', () => {
  it('pages past the old 500-row cap and keeps inclusive overlap bounds and filters', async () => {
    const { repository, service } = setup();
    expect(
      await service.listPublished({
        from: '2026-12-01',
        to: '2026-12-31',
        country: ['India', 'France'],
        format: ['hybrid'],
        page: 3,
        pageSize: 500,
      })
    ).toEqual({ items: [], total: 1649 });
    expect(repository.findPublishedPage).toHaveBeenCalledWith(
      {
        fromIso: '2026-12-01T00:00:00.000Z',
        toExclusiveIso: '2027-01-01T00:00:00.000Z',
        countries: ['India', 'France'],
        formats: ['hybrid'],
      },
      { from: 1000, to: 1499 }
    );
  });

  it('passes startFrom as a start-date bound, separate from the overlap bound', async () => {
    const { repository, service } = setup();
    await service.listPublished({ from: '2027-01-01', to: '2027-01-31', startFrom: '2027-01-01' });
    expect(repository.findPublishedPage).toHaveBeenCalledWith(
      expect.objectContaining({
        fromIso: '2027-01-01T00:00:00.000Z',
        startFromIso: '2027-01-01T00:00:00.000Z',
        toExclusiveIso: '2027-02-01T00:00:00.000Z',
      }),
      expect.anything()
    );
  });

  it('clips multi-day events, deduplicates days and handles events without an end', async () => {
    const { service } = setup();
    expect(await service.listEventDays({ from: '2026-12-01', to: '2026-12-03' })).toEqual({
      days: ['2026-12-01', '2026-12-02'],
    });
  });

  it('rejects reversed and oversized date spans before querying', async () => {
    const { service, repository } = setup();
    await expect(service.listPublished({ from: '2026-12-31', to: '2026-12-01' })).rejects.toThrow();
    await expect(service.listEventDays({ from: '2026-12-31', to: '2026-12-01' })).rejects.toThrow();
    await expect(service.listEventDays({ from: '2026-01-01', to: '2027-02-05' })).rejects.toThrow();
    expect(repository.findPublishedSpans).not.toHaveBeenCalled();
  });

  it('validates repeated filters, page bounds and date-only inputs', async () => {
    const query = plainToInstance(ListEventsQueryDto, {
      country: 'India',
      format: 'virtual',
      page: '2',
      pageSize: '1000',
    });
    expect(await validate(query)).toEqual([]);
    expect(query.country).toEqual(['India']);
    for (const invalid of [
      { page: 0 },
      { pageSize: 1001 },
      { format: ['unknown'] },
      { country: Array(21).fill('India') },
      { from: '2026-02-30' },
      { startFrom: '2026-13-01' },
      { to: '2026-12-01T12:00:00Z' },
    ]) {
      expect((await validate(plainToInstance(ListEventsQueryDto, invalid))).length).toBeGreaterThan(0);
    }
    expect((await validate(plainToInstance(EventDaysQueryDto, { from: '2026-12-01' }))).length).toBeGreaterThan(0);
  });
});

describe('event taxonomy filters', () => {
  it('turns a service line into its categories', async () => {
    const { repository, service } = setup();
    await service.listPublished({ serviceLineId: ['line-tax'] });
    expect(repository.findPublishedPage).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: ['cat-gst', 'cat-dt'] }),
      expect.anything()
    );
  });

  it('narrows explicit categories to the chosen service line', async () => {
    const { repository, service } = setup();
    await service.listPublished({ categoryId: ['cat-gst', 'cat-arb'], serviceLineId: ['line-legal'] });
    expect(repository.findPublishedPage).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: ['cat-arb'] }),
      expect.anything()
    );
  });

  it('applies no taxonomy filter when none is given', async () => {
    const { repository, service } = setup();
    await service.listPublished({});
    expect(repository.findPublishedPage).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: undefined }),
      expect.anything()
    );
  });
});

describe('home calendar', () => {
  const ev = (id: string, startDate: string, endDate: string | null = null) => ({
    id,
    title: id,
    startDate,
    endDate,
    country: null,
    eventFormat: null,
  });

  it('counts every event per day, returns two, and prefers events starting that day', async () => {
    const { repository, service } = setup();
    vi.mocked(repository.findPublishedSpans).mockResolvedValue([
      ev('a', '2026-12-01T09:00:00Z', '2026-12-02T18:00:00Z'),
      ev('b', '2026-12-01T10:00:00Z'),
      ev('c', '2026-12-01T11:00:00Z'),
      ev('d', '2026-12-02T10:00:00Z'),
    ]);
    const { days } = await service.listCalendar({ from: '2026-12-01', to: '2026-12-31' });
    expect(days.map((d) => [d.date, d.count, d.events.map((e) => e.id)])).toEqual([
      ['2026-12-01', 3, ['a', 'b']],
      ['2026-12-02', 2, ['d', 'a']],
    ]);
  });

  it('rejects a span over 62 days', async () => {
    const { service } = setup();
    await expect(service.listCalendar({ from: '2026-01-01', to: '2026-06-01' })).rejects.toMatchObject({
      response: { code: 'EVENT_RANGE_INVALID' },
    });
  });
});

describe('organiser filter and sidebar stats', () => {
  const facets = [
    { organiserName: 'ISCA', country: 'Singapore' },
    { organiserName: 'ISCA', country: 'singapore ' },
    { organiserName: 'ICAI', country: 'India' },
    { organiserName: '  ', country: null },
    { organiserName: null, country: 'India' },
  ];

  it('lists organisers by event count, skipping blanks', async () => {
    const { repository, service } = setup();
    Object.assign(repository, { findPublishedFacets: vi.fn().mockResolvedValue(facets) });
    expect(await service.listOrganisers()).toEqual([
      { name: 'ISCA', count: 2 },
      { name: 'ICAI', count: 1 },
    ]);
    expect(repository.findPublishedFacets).toHaveBeenCalledWith();
  });

  it('counts upcoming events and distinct countries/organisers', async () => {
    const { repository, service } = setup();
    Object.assign(repository, { findPublishedFacets: vi.fn().mockResolvedValue(facets) });
    expect(await service.getStats()).toEqual({ upcoming: 5, countries: 2, organisers: 2 });
    expect(repository.findPublishedFacets).toHaveBeenCalledWith(expect.stringMatching(/T00:00:00\.000Z$/));
  });

  it('passes the organiser filter through', async () => {
    const { repository, service } = setup();
    await service.listPublished({ organiser: ['ISCA'] });
    expect(repository.findPublishedPage).toHaveBeenCalledWith(
      expect.objectContaining({ organisers: ['ISCA'] }),
      expect.anything()
    );
  });
});
