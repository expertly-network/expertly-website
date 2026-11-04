'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { EventDto } from '@shared/event';
import type { CategoryDto } from '@shared/category';
import { Button, Card, MultiSelect } from '@/components/ui';
import { listEventsPage } from '@/lib/api/events';
import { formatDayOfMonth, formatMonth } from '@/lib/dates';
import { normalizeEventTitle } from '@/lib/events/format';
import {
  parseDashboardEventPreferences,
  selectDashboardEvents,
  type DashboardEventPreferences,
} from '@/lib/events/dashboard-preferences';

export function DashboardEvents({
  initialEvents,
  initialError,
  categories,
  defaults,
  userId,
}: {
  initialEvents: EventDto[];
  initialError: boolean;
  categories: CategoryDto[];
  defaults: DashboardEventPreferences;
  userId: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState(defaults);
  const storageKey = `growxq:dashboard-events:${userId}`;

  useEffect(() => {
    try {
      const saved = parseDashboardEventPreferences(JSON.parse(localStorage.getItem(storageKey) || 'null'));
      setPreferences(saved || defaults);
    } catch {
      setPreferences(defaults);
    }
  }, [storageKey, defaults]);

  useEffect(() => {
    let cancelled = false;
    // Include every upcoming page before applying city preferences; don't silently filter just
    // the API's first page. Keep the server-rendered picks while the rest arrive.
    async function load() {
      try {
        const from = new Date().toISOString().slice(0, 10);
        let page = 1;
        const all: EventDto[] = [];
        while (!cancelled) {
          const result = await listEventsPage({ from, page, pageSize: 1000 });
          all.push(...result.items);
          if (!result.items.length || all.length >= result.total) break;
          page += 1;
        }
        if (!cancelled) {
          setEvents(all);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  function update(next: DashboardEventPreferences) {
    setPreferences(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Session preferences still work. */
    }
  }
  const countries = [
    ...new Set([...defaults.country, ...preferences.country, ...events.flatMap((e) => (e.country ? [e.country] : []))]),
  ].sort();
  const locations = [
    ...new Set([...defaults.location, ...preferences.location, ...events.flatMap((e) => (e.city ? [e.city] : []))]),
  ].sort();
  const selected = selectDashboardEvents(events, preferences);
  const summary = [
    ...preferences.country,
    ...preferences.sector.map((id) => categories.find((c) => c.id === id)?.name || id),
    ...preferences.location,
  ];
  return (
    <Card padding="md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title text-ink">Upcoming events</h2>
        <Link href="/events" className="text-sm font-medium text-accent hover:underline">
          Browse all →
        </Link>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="dashboard-event-preferences"
        onClick={() => setOpen(!open)}
        className="flex w-full items-start justify-between gap-3 rounded-input border border-line bg-bg-alt p-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">Event preferences</span>
          <span className="mt-1 block text-caption text-ink-3">{summary.join(' · ') || 'All events'}</span>
        </span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div id="dashboard-event-preferences" className="mt-4 space-y-4">
          <MultiSelect
            label="Country"
            options={countries.map((v) => ({ value: v, label: v }))}
            selected={preferences.country}
            onChange={(country) => update({ ...preferences, country })}
            allowCustom
          />
          <MultiSelect
            label="Sector"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            selected={preferences.sector}
            onChange={(sector) => update({ ...preferences, sector })}
          />
          <MultiSelect
            label="Location"
            options={locations.map((v) => ({ value: v, label: v }))}
            selected={preferences.location}
            onChange={(location) => update({ ...preferences, location })}
            allowCustom
          />
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="text-sm text-ink-3 hover:text-ink" onClick={() => update(defaults)}>
              Reset to profile
            </button>
            <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      )}
      <div role="status" className="mt-4 text-caption text-ink-3">
        {error
          ? 'Some events could not be loaded. Refresh to try again.'
          : loading
            ? 'Updating your event picks…'
            : selected.related
              ? 'No exact matches. Showing events matching some of your preferences.'
              : `${selected.events.length} upcoming ${selected.events.length === 1 ? 'event' : 'events'}`}
      </div>
      {selected.events.length ? (
        <ul className="mt-2 max-h-96 divide-y divide-line overflow-y-auto">
          {selected.events.map((e) => (
            <li key={e.id}>
              <Link href={`/events#event-${e.id}`} className="group flex items-center gap-3 py-3">
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink group-hover:text-accent">
                    {normalizeEventTitle(e.title)}
                  </span>
                  <span className="mt-1 block text-caption text-ink-3">
                    {[e.city, e.country].filter(Boolean).join(', ') || 'Online'}
                  </span>
                </span>
                <span className="shrink-0 text-caption text-ink-3">
                  {formatMonth(e.startDate, { timeZone: e.timezone, utc: true }).slice(0, 3)}{' '}
                  {formatDayOfMonth(e.startDate, { timeZone: e.timezone, utc: true })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        !loading && (
          <p className="py-5 text-sm text-ink-3">
            No events match your preferences yet. Add more countries or sectors, or browse all events.
          </p>
        )
      )}
    </Card>
  );
}
