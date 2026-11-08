import type { LearningDto } from '@shared/resource';

// The learning library's filters, shared by the desktop selects/chips and the phone filter sheet so
// both offer the same options and match the same way.

export const ALL_TOPICS = 'All topics';

export interface LearningFilters {
  topic: string;
  audience: string;
  level: string;
  length: string;
}

export const DEFAULT_LEARNING_FILTERS: LearningFilters = {
  topic: ALL_TOPICS,
  audience: 'all',
  level: 'all',
  length: 'all',
};

export const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All professions' },
  { value: 'tax', label: 'Tax & accounting' },
  { value: 'legal', label: 'Law' },
  { value: 'audit', label: 'Audit' },
];

export const LEVEL_OPTIONS = [
  { value: 'all', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export const LENGTH_OPTIONS = [
  { value: 'all', label: 'Any length' },
  { value: 'short', label: 'Under 10 minutes' },
  { value: 'medium', label: '10–20 minutes' },
  { value: 'long', label: 'Over 20 minutes' },
];

/** Topic choices in library order, "All topics" first. */
export function topicOptions(videos: LearningDto[]): string[] {
  return [ALL_TOPICS, ...Array.from(new Set(videos.map((v) => v.category)))];
}

/** Whether a video passes the filters and the free-text search `q`. */
export function matchesLearning(v: LearningDto, f: LearningFilters, q: string): boolean {
  return (
    (f.topic === ALL_TOPICS || v.category === f.topic) &&
    (f.audience === 'all' || !v.audiences.length || v.audiences.includes(f.audience as 'tax' | 'legal' | 'audit')) &&
    (f.level === 'all' || v.level === f.level) &&
    (f.length === 'all' ||
      (f.length === 'short'
        ? v.durationMinutes < 10
        : f.length === 'medium'
          ? v.durationMinutes >= 10 && v.durationMinutes <= 20
          : v.durationMinutes > 20)) &&
    `${v.title} ${v.summary} ${v.channel || ''}`.toLowerCase().includes(q.toLowerCase())
  );
}
