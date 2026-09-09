'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, Input, Select, Textarea } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { createEvent, updateEvent } from '@/lib/api/events';
import { ApiError } from '@/lib/api/client';
import type { CreateEventRequest, EventDto, EventFormat } from '@shared/event';

// The prototype's admin event form (design/static_html/admin-dashboard.html) offers this fixed
// list as a <select>; events.event_type is free text, not an enum, so this form keeps the same
// options as <datalist> suggestions instead of locking the field to them.
const EVENT_TYPE_SUGGESTIONS = ['Tax', 'Legal', 'Audit', 'AI & Tech', 'Fintech', 'Law', 'Startup', 'General'];

const FORMAT_OPTIONS: { value: EventFormat; label: string }[] = [
  { value: 'in_person', label: 'In Person' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'virtual', label: 'Virtual' },
];

function toDateInputValue(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

interface FormState {
  title: string;
  description: string;
  shortDescription: string;
  startDate: string;
  endDate: string;
  timezone: string;
  eventType: string;
  eventFormat: EventFormat | '';
  country: string;
  city: string;
  venueName: string;
  isFree: boolean;
  registrationUrl: string;
  organiserName: string;
  coverImageUrl: string;
}

function toFormState(event?: EventDto): FormState {
  return {
    title: event?.title ?? '',
    description: event?.description ?? '',
    shortDescription: event?.shortDescription ?? '',
    startDate: toDateInputValue(event?.startDate),
    endDate: toDateInputValue(event?.endDate),
    timezone: event?.timezone ?? '',
    eventType: event?.eventType ?? '',
    eventFormat: event?.eventFormat ?? '',
    country: event?.country ?? '',
    city: event?.city ?? '',
    venueName: event?.venueName ?? '',
    isFree: event?.isFree ?? false,
    registrationUrl: event?.registrationUrl ?? '',
    organiserName: event?.organiserName ?? '',
    coverImageUrl: event?.coverImageUrl ?? '',
  };
}

// Mirrors the backend's PUBLISH_REQUIRED_FIELDS (apps/backend/src/events/publish-requirements.ts)
// exactly — draft saves only need title/description/startDate (native `required` below), but
// publishing needs all of these. Kept in sync by hand since one's a DTO-shaped service check and
// the other's this form's field-state keys; the backend remains the actual enforcement boundary,
// this is just the same rule surfaced as inline errors instead of a round trip.
const PUBLISH_REQUIRED_FIELDS: { key: keyof FormState; label: string }[] = [
  { key: 'title', label: 'Event title' },
  { key: 'organiserName', label: 'Organizer' },
  { key: 'description', label: 'Description' },
  { key: 'startDate', label: 'Start date' },
  { key: 'endDate', label: 'End date' },
  { key: 'eventFormat', label: 'Format' },
  { key: 'eventType', label: 'Category' },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'registrationUrl', label: 'Registration URL' },
];

// `null` (not `undefined`) for a blanked-out optional field — this doubles as both the create
// and edit request body, and on edit an omitted key means "leave unchanged" to the backend's
// partial-update semantics (EventsService.update()), not "clear it". Sending `null` explicitly
// is the only way to actually blank out a field an admin previously set (e.g. removing a venue
// name). `undefined`/`null` are equivalent on create (EventsService.create() falls back to
// `?? null` either way), so using `null` uniformly here is safe for both modes.
function toRequestBody(state: FormState, status: 'draft' | 'published'): CreateEventRequest {
  return {
    title: state.title,
    description: state.description,
    shortDescription: state.shortDescription || null,
    coverImageUrl: state.coverImageUrl || null,
    startDate: state.startDate,
    endDate: state.endDate || null,
    timezone: state.timezone || null,
    eventType: state.eventType || null,
    eventFormat: state.eventFormat || null,
    country: state.country || null,
    city: state.city || null,
    venueName: state.venueName || null,
    isFree: state.isFree,
    registrationUrl: state.registrationUrl || null,
    organiserName: state.organiserName || null,
    status,
  };
}

// Shared by /admin/events/new and /admin/events/[id]/edit — `event` present means edit mode
// (PATCH, prefilled), absent means create mode (POST, blank). Two explicit submit actions
// (Save as draft / Publish) rather than a status dropdown, matching events.status's two real
// states and the product decision made during design (draft-by-default, explicit publish).
export function EventForm({ event }: { event?: EventDto }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => toFormState(event));
  const [busy, setBusy] = useState<'draft' | 'published' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

  async function handleSave(status: 'draft' | 'published') {
    if (!state.title.trim() || !state.description.trim() || !state.startDate) {
      setError('Title, description, and start date are required.');
      setFieldErrors({});
      return;
    }

    // Draft can still be saved with just the above — these 10 fields (mirroring the backend's
    // publish-requirements.ts) are only enforced once an admin actually tries to publish, whether
    // that's a brand-new event or clicking "Save changes" on one that's already live.
    if (status === 'published') {
      const missing = PUBLISH_REQUIRED_FIELDS.filter(({ key }) => !String(state[key] ?? '').trim());
      if (missing.length > 0) {
        setFieldErrors(Object.fromEntries(missing.map(({ key }) => [key, 'Required to publish'])));
        setError('Fill in the required fields below to publish this event.');
        return;
      }
    }

    setFieldErrors({});
    setError(null);
    setBusy(status);
    try {
      const body = toRequestBody(state, status);
      if (event) {
        await updateEvent(event.id, body);
      } else {
        await createEvent(body);
      }
      router.push('/admin/events');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save this event.');
      setBusy(null);
    }
  }

  const publishLabel = event ? (event.status === 'published' ? 'Save changes' : 'Publish event') : 'Publish event';

  return (
    <Card padding="lg" className="max-w-3xl">
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            label="Event title"
            value={state.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Global Transfer Pricing Summit"
            required
          />
          <Input
            label="Organizer"
            value={state.organiserName}
            onChange={(e) => set('organiserName', e.target.value)}
            placeholder="e.g. Expertly Network"
            error={fieldErrors.organiserName}
          />
        </div>

        <Textarea
          label="Description"
          rows={3}
          value={state.description}
          onChange={(e) => set('description', e.target.value)}
          required
        />

        <Textarea
          label="Short description"
          hint="Optional one-line blurb."
          rows={2}
          value={state.shortDescription}
          onChange={(e) => set('shortDescription', e.target.value)}
        />

        <div className="grid grid-cols-4 gap-4 max-[900px]:grid-cols-2 max-[480px]:grid-cols-1">
          <Input
            label="Start date"
            type="date"
            value={state.startDate}
            onChange={(e) => set('startDate', e.target.value)}
            required
          />
          <Input
            label="End date"
            type="date"
            value={state.endDate}
            onChange={(e) => set('endDate', e.target.value)}
            error={fieldErrors.endDate}
          />
          <Select
            label="Format"
            value={state.eventFormat}
            onChange={(e) => set('eventFormat', e.target.value as EventFormat | '')}
            error={fieldErrors.eventFormat}
          >
            <option value="">Not specified</option>
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <div>
            <Input
              label="Category"
              list="event-type-suggestions"
              value={state.eventType}
              onChange={(e) => set('eventType', e.target.value)}
              placeholder="e.g. Tax"
              error={fieldErrors.eventType}
            />
            <datalist id="event-type-suggestions">
              {EVENT_TYPE_SUGGESTIONS.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 max-[640px]:grid-cols-1">
          <Input
            label="City"
            value={state.city}
            onChange={(e) => set('city', e.target.value)}
            placeholder="e.g. London"
            error={fieldErrors.city}
          />
          <Input
            label="Country"
            value={state.country}
            onChange={(e) => set('country', e.target.value)}
            placeholder="e.g. United Kingdom"
            error={fieldErrors.country}
          />
          <Input
            label="Venue"
            value={state.venueName}
            onChange={(e) => set('venueName', e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            label="Registration URL"
            type="url"
            value={state.registrationUrl}
            onChange={(e) => set('registrationUrl', e.target.value)}
            placeholder="https://…"
            error={fieldErrors.registrationUrl}
          />
          <Input
            label="Cover image URL"
            type="url"
            value={state.coverImageUrl}
            onChange={(e) => set('coverImageUrl', e.target.value)}
            placeholder="https://…"
          />
        </div>

        <Input
          label="Timezone"
          value={state.timezone}
          onChange={(e) => set('timezone', e.target.value)}
          placeholder="Optional, e.g. Europe/London"
        />

        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={state.isFree}
            onChange={(e) => set('isFree', e.target.checked)}
            className="h-4 w-4 rounded border-line-2 text-accent focus:ring-accent/20"
          />
          This event is free to attend
        </label>

        {error && <ErrorBanner message={error} />}

        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={() => handleSave('draft')} disabled={busy !== null}>
            {busy === 'draft' ? 'Saving…' : 'Save as draft'}
          </Button>
          <Button type="button" onClick={() => handleSave('published')} disabled={busy !== null}>
            {busy === 'published' ? 'Publishing…' : publishLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
