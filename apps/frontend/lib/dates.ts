// Every user-facing date in the app goes through here, so they all read the same way:
// "27 October 2026" — day, full month name (capitalised, never uppercased or abbreviated), year.
// `utc: true` is for date-only values stored as midnight UTC (testimonial dates, join dates), so
// they don't shift a day in time zones behind UTC.

type DateInput = string | number | Date;

interface Options {
  utc?: boolean;
  /** An IANA zone (e.g. an event's own `timezone`); wins over `utc`. */
  timeZone?: string | null;
}

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatter(parts: Intl.DateTimeFormatOptions, { utc, timeZone }: Options = {}): Intl.DateTimeFormat {
  const zone = timeZone || (utc ? 'UTC' : undefined);
  return new Intl.DateTimeFormat('en-GB', { ...parts, ...(zone ? { timeZone: zone } : {}) });
}

/** "27" */
export function formatDayOfMonth(value: DateInput, options?: Options): string {
  return formatter({ day: 'numeric' }, options).format(toDate(value));
}

/** "27 October 2026" */
export function formatDate(value: DateInput, options?: Options): string {
  return formatter({ day: 'numeric', month: 'long', year: 'numeric' }, options).format(toDate(value));
}

/** "27 October" */
export function formatDayMonth(value: DateInput, options?: Options): string {
  return formatter({ day: 'numeric', month: 'long' }, options).format(toDate(value));
}

/** "October 2026" */
export function formatMonthYear(value: DateInput, options?: Options): string {
  return formatter({ month: 'long', year: 'numeric' }, options).format(toDate(value));
}

/** "October" */
export function formatMonth(value: DateInput, options?: Options): string {
  return formatter({ month: 'long' }, options).format(toDate(value));
}

/** "3:45 pm" */
export function formatTime(value: DateInput, options?: Options): string {
  return formatter({ hour: 'numeric', minute: '2-digit', hour12: true }, options).format(toDate(value));
}

/** "27 October 2026, 3:45 pm" */
export function formatDateTime(value: DateInput, options?: Options): string {
  return `${formatDate(value, options)}, ${formatTime(value, options)}`;
}

/**
 * An event's date span: "27 October", "27–29 October", "30 October – 2 November" (no year — the
 * events list groups rows under a month-and-year heading).
 */
export function formatDayRange(start: DateInput, end: DateInput | null, options?: Options): string {
  const s = toDate(start);
  if (!end) return formatDayMonth(s, options);
  const e = toDate(end);
  const day = formatter({ day: 'numeric' }, options);
  if (formatDate(s, options) === formatDate(e, options)) return formatDayMonth(s, options);
  if (formatMonthYear(s, options) === formatMonthYear(e, options)) {
    return `${day.format(s)}–${day.format(e)} ${formatMonth(s, options)}`;
  }
  return `${formatDayMonth(s, options)} – ${formatDayMonth(e, options)}`;
}
