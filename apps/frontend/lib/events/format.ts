// Shared event display formatting — used by the homepage's Upcoming Events section and,
// once built, the standalone Events page.

export function formatEventMonth(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
}

export function formatEventDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric' });
}

const FORMAT_LABEL: Record<string, string> = {
  in_person: 'In Person',
  virtual: 'Virtual',
  hybrid: 'Hybrid',
};

export function formatEventFormat(format: string | null): string | null {
  return format ? (FORMAT_LABEL[format] ?? format) : null;
}
