'use client';

import { useMemo, useState } from 'react';
import { useLiveCount } from '@/lib/hooks/useLiveCount';
import { FilterSheet, FilterSheetOptions, FilterSheetSearch, FilterSheetSection } from '@/components/ui';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { EVENT_TYPES } from '@/lib/events/format';
import { DATE_PRESETS, FORMAT_TOGGLES, type DatePreset, type FormatToggle } from '@/lib/events/filters';
import type { CategoryDto } from '@shared/category';

/** `custom` = a from–to range picked in the desktop calendar; the sheet only offers the presets. */
export type EventDateChoice = DatePreset | 'custom';

export interface EventFilters {
  when: EventDateChoice;
  lines: string[];
  topics: string[];
  countries: string[];
  organisers: string[];
  types: string[];
  formats: FormatToggle[];
}

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

// Phone filter sheet for the events list (built on ui/FilterSheet). `countFor` gives the live
// "Show N events" figure for a draft; without it (the admin list) the button just says "Show events".
export function EventFiltersSheet({
  categories,
  organiserOptions,
  value,
  defaultWhen,
  countFor,
  onApply,
  onClose,
}: {
  categories: CategoryDto[];
  organiserOptions: { value: string; label: string }[];
  value: EventFilters;
  /** The list's default date preset — what "Clear all" goes back to. */
  defaultWhen: DatePreset;
  countFor?: (filters: EventFilters) => Promise<number>;
  onApply: (next: EventFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<EventFilters>(value);
  const [countryQuery, setCountryQuery] = useState('');
  const [organiserQuery, setOrganiserQuery] = useState('');

  const lineOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of categories) if (!seen.has(c.serviceLineId)) seen.set(c.serviceLineId, c.serviceLineName);
    return [...seen].map(([v, label]) => ({ value: v, label }));
  }, [categories]);
  const topicOptions = useMemo(
    () =>
      categories
        .filter((c) => draft.lines.length === 0 || draft.lines.includes(c.serviceLineId))
        .map((c) => ({ value: c.id, label: c.name })),
    [categories, draft.lines]
  );
  const countries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    return (q ? ALL_COUNTRIES.filter((c) => c.toLowerCase().includes(q)) : ALL_COUNTRIES).map((c) => ({
      value: c,
      label: c,
    }));
  }, [countryQuery]);
  const organisers = useMemo(() => {
    const q = organiserQuery.trim().toLowerCase();
    return q ? organiserOptions.filter((o) => o.label.toLowerCase().includes(q)) : organiserOptions;
  }, [organiserOptions, organiserQuery]);

  // Live result count for the draft; none without `countFor` (the admin list).
  const count = useLiveCount(draft, countFor);

  const lineByTopicId = useMemo(() => new Map(categories.map((c) => [c.id, c.serviceLineId])), [categories]);
  function setLines(next: string[]) {
    // Drop topics that fall outside the chosen areas.
    setDraft((d) => ({
      ...d,
      lines: next,
      topics: d.topics.filter((id) => next.length === 0 || next.includes(lineByTopicId.get(id) ?? '')),
    }));
  }

  const whenOptions = [
    ...DATE_PRESETS.map((p) => ({ value: p.value as EventDateChoice, label: p.label })),
    ...(value.when === 'custom' ? [{ value: 'custom' as EventDateChoice, label: 'Custom dates' }] : []),
  ];
  const canClear =
    draft.when !== defaultWhen ||
    draft.lines.length + draft.topics.length + draft.countries.length + draft.organisers.length > 0 ||
    draft.types.length + draft.formats.length > 0;

  return (
    <FilterSheet
      onClose={onClose}
      onApply={() => onApply(draft)}
      onClear={() =>
        setDraft({ when: defaultWhen, lines: [], topics: [], countries: [], organisers: [], types: [], formats: [] })
      }
      canClear={canClear}
      count={countFor ? count : null}
      noun={{ one: 'event', other: 'events' }}
    >
      <FilterSheetSection title="When" selected={draft.when === defaultWhen ? 0 : 1} defaultOpen>
        <FilterSheetOptions
          single
          name="event-when"
          options={whenOptions}
          selected={[draft.when]}
          onToggle={(v) => setDraft((d) => ({ ...d, when: v as EventDateChoice }))}
        />
      </FilterSheetSection>
      <FilterSheetSection title="Format" selected={draft.formats.length}>
        <FilterSheetOptions
          options={FORMAT_TOGGLES}
          selected={draft.formats}
          onToggle={(v) => setDraft((d) => ({ ...d, formats: toggle(d.formats, v as FormatToggle) }))}
        />
      </FilterSheetSection>
      {lineOptions.length > 0 && (
        <FilterSheetSection title="Area" selected={draft.lines.length}>
          <FilterSheetOptions
            options={lineOptions}
            selected={draft.lines}
            onToggle={(v) => setLines(toggle(draft.lines, v))}
          />
        </FilterSheetSection>
      )}
      {categories.length > 0 && (
        <FilterSheetSection title="Topic" selected={draft.topics.length}>
          <FilterSheetOptions
            options={topicOptions}
            selected={draft.topics}
            onToggle={(v) => setDraft((d) => ({ ...d, topics: toggle(d.topics, v) }))}
            scroll
            emptyText="No topics in the chosen areas."
          />
        </FilterSheetSection>
      )}
      <FilterSheetSection title="Country" selected={draft.countries.length}>
        <FilterSheetSearch value={countryQuery} onChange={setCountryQuery} label="countries" />
        <FilterSheetOptions
          options={countries}
          selected={draft.countries}
          onToggle={(v) => setDraft((d) => ({ ...d, countries: toggle(d.countries, v) }))}
          scroll
          emptyText="No matching countries."
        />
      </FilterSheetSection>
      <FilterSheetSection title="Event type" selected={draft.types.length}>
        <FilterSheetOptions
          options={EVENT_TYPES.map((t) => ({ value: t, label: t }))}
          selected={draft.types}
          onToggle={(v) => setDraft((d) => ({ ...d, types: toggle(d.types, v) }))}
          scroll
        />
      </FilterSheetSection>
      {organiserOptions.length > 0 && (
        <FilterSheetSection title="Organiser" selected={draft.organisers.length}>
          <FilterSheetSearch value={organiserQuery} onChange={setOrganiserQuery} label="organisers" />
          <FilterSheetOptions
            options={organisers}
            selected={draft.organisers}
            onToggle={(v) => setDraft((d) => ({ ...d, organisers: toggle(d.organisers, v) }))}
            scroll
            emptyText="No matching organisers."
          />
        </FilterSheetSection>
      )}
    </FilterSheet>
  );
}
