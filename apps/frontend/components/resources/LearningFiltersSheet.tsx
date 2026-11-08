'use client';

import { useState } from 'react';
import { FilterSheet, FilterSheetOptions, FilterSheetSection } from '@/components/ui';
import { useLiveCount } from '@/lib/hooks/useLiveCount';
import type { LearningDto } from '@shared/resource';
import {
  AUDIENCE_OPTIONS,
  DEFAULT_LEARNING_FILTERS,
  LENGTH_OPTIONS,
  LEVEL_OPTIONS,
  matchesLearning,
  topicOptions,
  type LearningFilters,
} from './learning-filters';

// Phone filter sheet for the learning library (built on ui/FilterSheet). The library is filtered in
// the browser, so the live count is computed from the loaded videos, not fetched.
export function LearningFiltersSheet({
  videos,
  query,
  value,
  onApply,
  onClose,
}: {
  videos: LearningDto[];
  /** The hero search text, so the count matches what "Show" will display. */
  query: string;
  value: LearningFilters;
  onApply: (next: LearningFilters) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<LearningFilters>(value);
  const count = useLiveCount(draft, async (d) => videos.filter((v) => matchesLearning(v, d, query)).length, 0);
  const set = (key: keyof LearningFilters) => (v: string) => setDraft((d) => ({ ...d, [key]: v }));
  const changed = (key: keyof LearningFilters) => (draft[key] === DEFAULT_LEARNING_FILTERS[key] ? 0 : 1);

  return (
    <FilterSheet
      onClose={onClose}
      onApply={() => onApply(draft)}
      onClear={() => setDraft(DEFAULT_LEARNING_FILTERS)}
      canClear={(Object.keys(draft) as (keyof LearningFilters)[]).some((k) => changed(k))}
      count={count}
      noun={{ one: 'video', other: 'videos' }}
    >
      <FilterSheetSection title="Topic" selected={changed('topic')} defaultOpen>
        <FilterSheetOptions
          single
          name="learning-topic"
          options={topicOptions(videos).map((t) => ({ value: t, label: t }))}
          selected={[draft.topic]}
          onToggle={set('topic')}
          scroll
        />
      </FilterSheetSection>
      <FilterSheetSection title="Your profession" selected={changed('audience')}>
        <FilterSheetOptions
          single
          name="learning-audience"
          options={AUDIENCE_OPTIONS}
          selected={[draft.audience]}
          onToggle={set('audience')}
        />
      </FilterSheetSection>
      <FilterSheetSection title="Level" selected={changed('level')}>
        <FilterSheetOptions
          single
          name="learning-level"
          options={LEVEL_OPTIONS}
          selected={[draft.level]}
          onToggle={set('level')}
        />
      </FilterSheetSection>
      <FilterSheetSection title="Length" selected={changed('length')}>
        <FilterSheetOptions
          single
          name="learning-length"
          options={LENGTH_OPTIONS}
          selected={[draft.length]}
          onToggle={set('length')}
        />
      </FilterSheetSection>
    </FilterSheet>
  );
}
