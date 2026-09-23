'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StepActions } from '@/components/apply/StepActions';
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
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const allServices = categories.flatMap((c) => c.services);
  const visibleServices =
    categoryFilter === 'all'
      ? allServices
      : categories.find((c) => c.id === categoryFilter)?.services ?? [];

  const prefs = form.servicePreferences;
  const setPreference = (priority: 1 | 2 | 3, serviceId: string) => {
    const withoutThis = prefs.filter((p) => p.priority !== priority);
    update({
      servicePreferences: serviceId
        ? [...withoutThis, { serviceId, priority }].sort((a, b) => a.priority - b.priority)
        : withoutThis,
    });
  };
  const preferenceFor = (priority: 1 | 2 | 3) =>
    prefs.find((p) => p.priority === priority)?.serviceId ?? '';
  const setCustomLabel = (priority: 1 | 2 | 3, customLabel: string) => {
    update({
      servicePreferences: prefs.map((p) => (p.priority === priority ? { ...p, customLabel } : p)),
    });
  };
  const customLabelFor = (priority: 1 | 2 | 3) =>
    prefs.find((p) => p.priority === priority)?.customLabel ?? '';
  const isCustomService = (serviceId: string) => allServices.find((s) => s.id === serviceId)?.isCustom ?? false;

  const minDollars = Number(form.rateMinDollars);
  const maxDollars = Number(form.rateMaxDollars);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!preferenceFor(1)) e.servicePreference1 = '1st preference is required.';
    if (form.rateMinDollars === '') e.rateMinDollars = 'Minimum rate is required.';
    if (form.rateMaxDollars === '') e.rateMaxDollars = 'Maximum rate is required.';
    if (form.rateMinDollars !== '' && form.rateMaxDollars !== '' && maxDollars <= minDollars) {
      e.rateMaxDollars = 'Max must be greater than min.';
    }
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
      <p className="mt-2 text-lede text-ink-3">
        Select your service preferences and set your consultation rate.
      </p>

      <div className="mt-7">
        <span className="mb-3 block text-mono-label text-ink-3">
          SERVICE PREFERENCES — RANK YOUR TOP 3
        </span>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
              categoryFilter === 'all'
                ? 'border-ink bg-ink text-bg'
                : 'border-line text-ink-3 hover:border-ink-3'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                categoryFilter === c.id
                  ? 'border-ink bg-ink text-bg'
                  : 'border-line text-ink-3 hover:border-ink-3'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Select
            id="servicePreference1"
            label="1st Preference"
            value={preferenceFor(1)}
            onChange={(e) => setPreference(1, e.target.value)}
            error={errors.servicePreference1}
            required
          >
            <option value="">Select service…</option>
            {visibleServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {preferenceFor(1) && isCustomService(preferenceFor(1)) && (
            <Input
              label="Describe this custom service"
              value={customLabelFor(1)}
              onChange={(e) => setCustomLabel(1, e.target.value)}
            />
          )}

          <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            <Select
              label="2nd Preference"
              value={preferenceFor(2)}
              onChange={(e) => setPreference(2, e.target.value)}
            >
              <option value="">Select service…</option>
              {visibleServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Select
              label="3rd Preference"
              value={preferenceFor(3)}
              onChange={(e) => setPreference(3, e.target.value)}
            >
              <option value="">Select service…</option>
              {visibleServices.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
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
        <p className="mt-1.5 text-sm text-ink-3">
          Your typical hourly fee range in USD. You can adjust this anytime.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <Input
          id="rateMinDollars"
          label="Min (USD / hour)"
          type="number"
          min={0}
          placeholder="e.g. 500"
          value={form.rateMinDollars}
          onChange={(e) => update({ rateMinDollars: e.target.value })}
          error={errors.rateMinDollars}
        />
        <Input
          id="rateMaxDollars"
          label="Max (USD / hour)"
          type="number"
          min={0}
          placeholder="e.g. 2000"
          value={form.rateMaxDollars}
          onChange={(e) => update({ rateMaxDollars: e.target.value })}
          error={errors.rateMaxDollars}
        />
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
