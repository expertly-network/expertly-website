'use client';

import { useState } from 'react';
import { RATE_FLOOR, RATE_CEILING } from '@shared/consultation-rates';
import { rateErrors } from '@/lib/apply/rate-errors';
import { Input } from '@/components/ui/Input';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { StepActions } from '@/components/apply/StepActions';
import { ServiceGuide } from '@/components/apply/ServiceGuide';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { scrollToFirstError } from '@/components/apply/scrollToError';
import type { WizardFormState } from '@/components/apply/types';
import type { CategoryDto } from '@shared/category';

export function ServicesRatesStep({
  form,
  update,
  categories,
  saving,
  saveError,
  onBack,
  onNext,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  categories: CategoryDto[];
  saving?: boolean;
  saveError?: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const allServices = categories.flatMap((c) => c.services);
  // One flat list of every service, each carrying its full path ("Tax › Direct Tax") — the same
  // service name under several categories shows up as distinct, searchable options instead of
  // making the applicant pick a category first.
  const serviceOptions: ComboboxOption[] = categories.flatMap((c) =>
    c.services.map((s) => ({
      value: s.id,
      label: s.name,
      context: `${c.serviceLineName} › ${c.name}`,
    }))
  );

  const prefs = form.servicePreferences;
  const setPreference = (priority: 1 | 2 | 3, serviceId: string) => {
    const withoutThis = prefs.filter((p) => p.priority !== priority);
    update({
      servicePreferences: serviceId
        ? [...withoutThis, { serviceId, priority }].sort((a, b) => a.priority - b.priority)
        : withoutThis,
    });
    if (priority === 1) setErrors((prev) => ({ ...prev, servicePreference1: '' }));
  };
  const preferenceFor = (priority: 1 | 2 | 3) => prefs.find((p) => p.priority === priority)?.serviceId ?? '';
  // The same service (most often "Other") picked in more than one slot collides on
  // member_services' (member_id, service_id) primary key at approval time — excluding ids
  // already chosen elsewhere prevents that at the source instead of erroring later.
  const optionsFor = (priority: 1 | 2 | 3) => {
    const takenElsewhere = new Set(prefs.filter((p) => p.priority !== priority && p.serviceId).map((p) => p.serviceId));
    return serviceOptions.filter((o) => !takenElsewhere.has(o.value));
  };
  const setCustomLabel = (priority: 1 | 2 | 3, customLabel: string) => {
    update({
      servicePreferences: prefs.map((p) => (p.priority === priority ? { ...p, customLabel } : p)),
    });
  };
  const customLabelFor = (priority: 1 | 2 | 3) => prefs.find((p) => p.priority === priority)?.customLabel ?? '';
  const isCustomService = (serviceId: string) => allServices.find((s) => s.id === serviceId)?.isCustom ?? false;

  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!preferenceFor(1)) e.servicePreference1 = '1st preference is required.';
    Object.assign(e, rateErrors(form.rateMinDollars, form.rateMaxDollars));
    return e;
  }

  function handleNext() {
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      scrollToFirstError(fieldErrors);
      return;
    }
    setErrors({});
    onNext();
  }

  return (
    <div>
      <h2 className="text-heading text-ink">Your services.</h2>
      <p className="mt-2 text-lede text-ink-3">Select your service preferences and set your consultation rate.</p>

      <div className="mt-7">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-mono-label text-ink-3">SERVICE PREFERENCES — RANK YOUR TOP 3</span>
          <ServiceGuide categories={categories} />
        </div>

        <p className="-mt-1.5 mb-4 text-sm text-ink-3">
          Search by service or practice area — the same service can sit under more than one category, so pick the one
          that fits you best.
        </p>

        <div className="flex flex-col gap-4">
          <Combobox
            id="servicePreference1"
            label="1st Preference"
            value={preferenceFor(1)}
            onChange={(v) => setPreference(1, v)}
            options={optionsFor(1)}
            placeholder="Select service…"
            searchPlaceholder="Search services, e.g. M&A tax"
            emptyText="No services match — try a shorter search, or pick “Other”."
            error={errors.servicePreference1}
            markRequired
          />
          {preferenceFor(1) && isCustomService(preferenceFor(1)) && (
            <Input
              label="Describe this custom service"
              value={customLabelFor(1)}
              onChange={(e) => setCustomLabel(1, e.target.value)}
            />
          )}

          <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            {([2, 3] as const).map((priority) => (
              <Combobox
                key={priority}
                label={priority === 2 ? '2nd Preference' : '3rd Preference'}
                value={preferenceFor(priority)}
                onChange={(v) => setPreference(priority, v)}
                options={optionsFor(priority)}
                placeholder="Select service…"
                searchPlaceholder="Search services, e.g. M&A tax"
                emptyText="No services match — try a shorter search, or pick “Other”."
                clearable
              />
            ))}
          </div>
          {preferenceFor(2) && isCustomService(preferenceFor(2)) && (
            <Input
              label="Describe this custom service (2nd preference)"
              value={customLabelFor(2)}
              onChange={(e) => setCustomLabel(2, e.target.value)}
            />
          )}
          {preferenceFor(3) && isCustomService(preferenceFor(3)) && (
            <Input
              label="Describe this custom service (3rd preference)"
              value={customLabelFor(3)}
              onChange={(e) => setCustomLabel(3, e.target.value)}
            />
          )}
        </div>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <span className="text-mono-label text-ink-3">CONSULTATION RATES</span>
        <p className="mt-1.5 text-sm text-ink-3">Your typical hourly fee range in USD. You can adjust this anytime.</p>
      </div>

      <p className="mt-3 text-xs text-ink-3">
        Enter $20–$500/hour. Your maximum must be greater than your minimum, with a gap of no more than $250.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        {(['min', 'max'] as const).map((bound) => {
          const field = bound === 'min' ? 'rateMinDollars' : 'rateMaxDollars';
          return (
            <Input
              key={field}
              id={field}
              label={bound === 'min' ? 'Min (USD / hour)' : 'Max (USD / hour)'}
              type="number"
              min={RATE_FLOOR}
              max={RATE_CEILING}
              step="0.01"
              placeholder={bound === 'min' ? 'e.g. 50' : 'e.g. 100'}
              value={form[field]}
              onChange={(event) => {
                update({ [field]: event.target.value });
                setErrors((prev) => ({ ...prev, rateMinDollars: '', rateMaxDollars: '' }));
              }}
              error={errors[field]}
            />
          );
        })}
      </div>

      {saveError && (
        <div className="mt-6">
          <ErrorBanner message={saveError} />
        </div>
      )}

      <StepActions
        onBack={onBack}
        onNext={handleNext}
        nextLabel={saving ? 'Saving…' : 'Next: Review'}
        nextDisabled={saving}
      />
    </div>
  );
}
