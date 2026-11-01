// Shared event display formatting — used by the homepage's Upcoming Events section and,
// once built, the standalone Events page.

import { formatDayOfMonth, formatMonth } from '@/lib/dates';

export function formatEventMonth(iso: string): string {
  return formatMonth(iso);
}

export function formatEventDay(iso: string): string {
  return formatDayOfMonth(iso);
}

// The event type labels the public filter offers. events.event_type is free text; these are the
// values the event imports use, matched exactly by GET /v1/events?type=.
export const EVENT_TYPES = [
  'Seminar',
  'Webinar',
  'Conference',
  'Training',
  'Workshop',
  'Forum',
  'Certificate Course',
  'Roundtable',
  'Summit',
] as const;

const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In Person',
  virtual: 'Online',
  hybrid: 'Hybrid',
};

// An online event has no physical location — show "Online" wherever a location would go, never
// the city/country an admin may have filled in.
export function isOnlineEvent(event: { eventFormat: string | null }): boolean {
  return event.eventFormat === 'virtual';
}

export function formatEventFormat(format: string | null): string | null {
  return format ? (FORMAT_LABEL[format] ?? format) : null;
}

// Short words kept lower-case inside a title-cased heading (never as the first word).
const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'under',
  'with',
  'vs',
]);

// Imported event titles arrive in mixed shapes ("SEMINAR ON FILING OF MCA FORMS", "IBC , 2016").
// Display-time clean-up: tidy whitespace before punctuation, and title-case a title written
// entirely in capitals. Short all-caps tokens (MCA, GST, IBC) stay as acronyms.
export function normalizeEventTitle(title: string): string {
  let t = title
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/,(?=[^\s\d])/g, ', ')
    .trim();

  const letters = t.replace(/[^A-Za-z]/g, '');
  const upper = letters.replace(/[^A-Z]/g, '');
  if (letters.length >= 8 && upper.length / letters.length > 0.85) {
    let first = true;
    t = t.replace(/[A-Za-z0-9][A-Za-z0-9'’]*/g, (word) => {
      const lower = word.toLowerCase();
      // Ordinals and numbers ("57TH", "2025") just lose their capitals.
      if (/^\d/.test(word)) {
        first = false;
        return lower;
      }
      const isFirst = first;
      first = false;
      if (!isFirst && MINOR_WORDS.has(lower)) return lower;
      // 2–4 letter all-caps words that aren't ordinary words are treated as acronyms.
      if (word.length <= 4 && word === word.toUpperCase() && !MINOR_WORDS.has(lower) && !COMMON_SHORT.has(lower)) {
        return word;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    });
  }
  return t;
}

// Ordinary short words that should be title-cased rather than kept as acronyms.
const COMMON_SHORT = new Set([
  'act',
  'new',
  'law',
  'tax',
  'day',
  'key',
  'how',
  'why',
  'what',
  'from',
  'into',
  'your',
  'our',
  'all',
  'are',
  'is',
  'it',
  'its',
  'be',
  'up',
  'out',
  'top',
  'two',
  'one',
  'more',
  'year',
  'meet',
  'live',
  'role',
  'risk',
  'deal',
  'audit',
  'rule',
  'rules',
  'era',
  'big',
  'next',
  'best',
  'case',
  'cost',
  'data',
  'form',
  'forms',
  'fund',
  'debt',
  'loan',
  'land',
  'over',
  'part',
  'plan',
  'sale',
  'tips',
  'need',
  'news',
  'firm',
  'firms',
  'work',
  'with',
  'this',
  'that',
  'will',
  'can',
  'do',
  'not',
  'no',
  'we',
  'you',
  'us',
]);
