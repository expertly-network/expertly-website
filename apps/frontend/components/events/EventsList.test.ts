// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventDto } from '@shared/event';
import { EventsList, formatsForToggles } from './EventsList';
import { listEventsPage } from '@/lib/api/events';

vi.mock('@/lib/api/events', () => ({
  listEventsPage: vi.fn(),
  getEventDays: vi.fn(),
  getEventOrganisers: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/components/events/EventRow', () => ({
  EventRow: ({ event }: { event: EventDto }) => React.createElement('div', null, event.title),
}));
vi.mock('@/components/ui', () => ({
  startOfDay: (date: Date) => new Date(new Date(date).setHours(0, 0, 0, 0)),
  DateRangePicker: () => null,
  FilterPopover: () => null,
  MobileFilterBar: () => null,
  Card: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) =>
    React.createElement('button', { onClick }, children),
}));

const event = (id: string, startDate = '2026-12-01T12:00:00Z'): EventDto => ({
  id,
  title: `Event ${id}`,
  slug: id,
  startDate,
  endDate: null,
  description: '',
  categoryIds: [],
  shortDescription: null,
  coverImageUrl: null,
  timezone: null,
  eventType: null,
  eventFormat: null,
  country: null,
  city: null,
  venueName: null,
  isFree: true,
  registrationUrl: null,
  organiserName: null,
  status: 'published',
  createdAt: '',
  updatedAt: '',
});

let root: Root;
let container: HTMLDivElement;
// Every observed month section, so a test can bring them all "into view".
let observers: (() => void)[] = [];

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  observers = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observers.push(() =>
          callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver)
        );
      }
      observe() {}
      disconnect() {}
    }
  );
  vi.mocked(listEventsPage).mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const loadMoreButtons = () =>
  Array.from(container.querySelectorAll('button')).filter((b) => /^Show (all|\d)/.test(b.textContent ?? ''));
const bringIntoView = () => act(async () => observers.forEach((fire) => fire()));
const clickButton = (text: string) =>
  act(async () =>
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.startsWith(text))
      ?.click()
  );

// Requests are routed by query: pageSize 1 is the first/last-match lookup, anything else a month batch.
type Q = { from?: string; to?: string; page?: number; pageSize?: number };

describe('events grouped by month with per-month growing "Load more" batches', () => {
  it('shows every month from the first to the last match, opening each month in growing batches', async () => {
    const dec = Array.from({ length: 40 }, (_, i) => event(`d${i}`, '2026-12-05T12:00:00Z'));
    vi.mocked(listEventsPage).mockImplementation(async (q: Q) => {
      if (q.pageSize === 1)
        return q.page === 1
          ? { items: [dec[0]], total: 41 }
          : { items: [event('j0', '2027-01-10T12:00:00Z')], total: 41 };
      if (q.from?.startsWith('2026-12')) {
        const size = q.pageSize ?? 50;
        const page = q.page ?? 1;
        return { items: dec.slice((page - 1) * size, page * size), total: dec.length };
      }
      return { items: [event('j0', '2027-01-10T12:00:00Z')], total: 1 };
    });

    await act(async () => root.render(React.createElement(EventsList, { remote: { total: 41 } })));
    await bringIntoView();

    expect(container.textContent).toContain('December 2026');
    expect(container.textContent).toContain('January 2027');
    // A month opens with its first 10 events.
    expect(container.textContent).toContain('Event d9');
    expect(container.textContent).not.toContain('Event d10');
    // December has more; January (one event) has no button.
    expect(loadMoreButtons().map((b) => b.textContent)).toEqual(['Show 25 more · 30 left']);
    expect(listEventsPage).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-12-01', to: '2026-12-31', page: 1, pageSize: 10 })
    );

    // Later months only list events that start in them (no repeats of a running event).
    expect(listEventsPage).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2027-01-01', startFrom: '2027-01-01', pageSize: 10 })
    );
    expect(listEventsPage).not.toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-12-01', startFrom: expect.anything() })
    );

    // +25: the month's first 35 in one request.
    await clickButton('Show 25 more');
    expect(listEventsPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: '2026-12-01', page: 1, pageSize: 35 })
    );
    expect(container.textContent).toContain('Event d34');
    expect(container.textContent).not.toContain('Event d35');
    // The next batch (+50) covers the rest, so the button offers all of it.
    expect(loadMoreButtons().map((b) => b.textContent)).toEqual(['Show all 5 remaining']);

    await clickButton('Show all 5 remaining');
    expect(container.textContent).toContain('Event d39');
    expect(loadMoreButtons().length).toBe(0);
  });

  it('hides a month with no matches and retries a failed month page', async () => {
    let failOnce = true;
    vi.mocked(listEventsPage).mockImplementation(async (q: Q) => {
      if (q.pageSize === 1)
        return q.page === 1
          ? { items: [event('a', '2026-12-02T12:00:00Z')], total: 2 }
          : { items: [event('b', '2027-02-02T12:00:00Z')], total: 2 };
      if (q.from?.startsWith('2027-01')) return { items: [], total: 0 };
      if (q.from?.startsWith('2027-02') && failOnce) {
        failOnce = false;
        throw new Error('Offline');
      }
      return q.from?.startsWith('2026-12')
        ? { items: [event('a', '2026-12-02T12:00:00Z')], total: 1 }
        : { items: [event('b', '2027-02-02T12:00:00Z')], total: 1 };
    });

    await act(async () => root.render(React.createElement(EventsList, { remote: { total: 2 } })));
    await bringIntoView();

    expect(container.textContent).toContain('December 2026');
    expect(container.textContent).not.toContain('January 2027');
    expect(container.textContent).toContain('Try again');

    await clickButton('Try again');
    expect(container.textContent).toContain('Event b');
    expect(container.textContent).not.toContain('Try again');
  });
});

describe('format toggles (a hybrid event is both)', () => {
  it('maps the two toggles onto the stored formats', () => {
    expect(formatsForToggles([])).toBeUndefined();
    expect(formatsForToggles(['in_person'])).toEqual(['in_person', 'hybrid']);
    expect(formatsForToggles(['online'])).toEqual(['virtual', 'hybrid']);
    expect(formatsForToggles(['in_person', 'online'])).toEqual(['hybrid']);
  });
});
