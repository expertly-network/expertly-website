// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventDto } from '@shared/event';
import { EventsList } from './EventsList';
import { listEventsPage } from '@/lib/api/events';

vi.mock('@/lib/api/events', () => ({ listEventsPage: vi.fn(), getEventDays: vi.fn() }));
vi.mock('@/components/events/EventRow', () => ({
  EventRow: ({ event }: { event: EventDto }) => React.createElement('div', null, event.title),
}));
vi.mock('@/components/ui', () => ({
  startOfDay: (date: Date) => new Date(new Date(date).setHours(0, 0, 0, 0)),
  DateRangePicker: () => null,
  FilterPopover: () => null,
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
  Array.from(container.querySelectorAll('button')).filter((b) => b.textContent?.startsWith('Load more'));
const bringIntoView = () => act(async () => observers.forEach((fire) => fire()));
const clickButton = (text: string) =>
  act(async () =>
    Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.startsWith(text))
      ?.click()
  );

// Requests are routed by query: pageSize 1 is the first/last-match lookup, pageSize 6 a month page.
type Q = { from?: string; to?: string; page?: number; pageSize?: number };

describe('events grouped by month with per-month "Load more"', () => {
  it('shows every month from the first to the last match, each with its own Load more', async () => {
    const dec = Array.from({ length: 8 }, (_, i) => event(`d${i}`, '2026-12-05T12:00:00Z'));
    vi.mocked(listEventsPage).mockImplementation(async (q: Q) => {
      if (q.pageSize === 1)
        return q.page === 1
          ? { items: [dec[0]], total: 9 }
          : { items: [event('j0', '2027-01-10T12:00:00Z')], total: 9 };
      if (q.from?.startsWith('2026-12')) {
        const page = q.page ?? 1;
        return { items: dec.slice((page - 1) * 6, page * 6), total: 8 };
      }
      return { items: [event('j0', '2027-01-10T12:00:00Z')], total: 1 };
    });

    await act(async () => root.render(React.createElement(EventsList, { remote: { total: 9 } })));
    await bringIntoView();

    expect(container.textContent).toContain('December 2026');
    expect(container.textContent).toContain('January 2027');
    expect(container.textContent).toContain('Event d5');
    expect(container.textContent).not.toContain('Event d6');
    // December has more; January (one event) has no button.
    expect(loadMoreButtons().length).toBe(1);
    expect(listEventsPage).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-12-01', to: '2026-12-31', page: 1, pageSize: 6 })
    );

    // Later months only list events that start in them (no repeats of a running event).
    expect(listEventsPage).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2027-01-01', startFrom: '2027-01-01', pageSize: 6 })
    );
    expect(listEventsPage).not.toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-12-01', startFrom: expect.anything() })
    );

    await clickButton('Load more from December 2026');
    expect(listEventsPage).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-12-01', page: 2 }));
    expect(container.textContent).toContain('Event d7');
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
