import { describe, expect, it } from 'vitest';
import type { EventDto } from '@shared/event';
import { parseDashboardEventPreferences, selectDashboardEvents } from './dashboard-preferences';

const events = [
  { id: 'a', country: 'India', city: 'Mumbai', categoryIds: ['tax'] },
  { id: 'b', country: 'India', city: 'Delhi', categoryIds: ['legal'] },
  { id: 'c', country: 'Singapore', city: 'Singapore', categoryIds: ['tax'] },
] as EventDto[];

describe('dashboard event preferences', () => {
  it('shows all events with no preferences', () => {
    expect(selectDashboardEvents(events, { country: [], sector: [], location: [] })).toEqual({
      events,
      related: false,
    });
  });
  it('matches any value within a field and every selected field', () => {
    const selected = selectDashboardEvents(events, {
      country: ['India', 'Singapore'],
      sector: ['tax'],
      location: ['Mumbai'],
    });
    expect(selected.events.map((e) => e.id)).toEqual(['a']);
    expect(selected.related).toBe(false);
  });
  it('ignores case and surrounding whitespace in country and city', () => {
    expect(
      selectDashboardEvents(events, { country: [' india '], sector: [], location: ['MUMBAI'] }).events.map((e) => e.id)
    ).toEqual(['a']);
  });
  it('labels a fallback as related without treating unselected fields as matches', () => {
    expect(selectDashboardEvents(events, { country: ['UK'], sector: ['legal'], location: [] })).toEqual({
      events: [events[1]],
      related: true,
    });
  });
  it('keeps a true empty state when nothing matches even one preference', () => {
    expect(selectDashboardEvents(events, { country: ['UK'], sector: [], location: [] })).toEqual({
      events: [],
      related: false,
    });
  });
  it('rejects malformed saved values instead of crashing the preferences UI', () => {
    for (const value of [
      null,
      [],
      { country: 'India', sector: [], location: [] },
      { country: [1], sector: [], location: [] },
      { country: [], sector: [] },
    ]) {
      expect(parseDashboardEventPreferences(value)).toBeNull();
    }
    const valid = { country: ['India'], sector: ['tax'], location: ['Mumbai'] };
    expect(parseDashboardEventPreferences(valid)).toEqual(valid);
  });
});
