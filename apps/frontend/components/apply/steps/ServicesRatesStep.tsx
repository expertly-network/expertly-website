'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StepActions } from '@/components/apply/StepActions';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { REQUIRED_MSG, useAttemptedNext, type WizardFormState } from '@/components/apply/types';
import type { PracticeAreaCategory, PracticeAreaDto } from '@shared/practice-area';

const CATEGORY_LABELS: Record<PracticeAreaCategory, string> = {
  taxation: 'Taxation',
  legal: 'Legal',
  finance_advisory: 'Finance & Advisory',
};

export function ServicesRatesStep({
  form,
  update,
  practiceAreas,
  saving,
  saveError,
  onBack,
  onNext,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  practiceAreas: PracticeAreaDto[];
  saving?: boolean;
  saveError?: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const [categoryFilter, setCategoryFilter] = useState<PracticeAreaCategory | 'all'>('all');

  const visibleAreas =
    categoryFilter === 'all' ? practiceAreas : practiceAreas.filter((a) => a.category === categoryFilter);

  const prefs = form.servicePreferences;
  const setPreference = (priority: 1 | 2 | 3, practiceAreaId: string) => {
    const withoutThis = prefs.filter((p) => p.priority !== priority);
    update({
      servicePreferences: practiceAreaId
        ? [...withoutThis, { practiceAreaId, priority }].sort((a, b) => a.priority - b.priority)
        : withoutThis,
    });
  };
  const preferenceFor = (priority: 1 | 2 | 3) =>
    prefs.find((p) => p.priority === priority)?.practiceAreaId ?? '';

  const minDollars = Number(form.rateMinDollars);
  const maxDollars = Number(form.rateMaxDollars);
  const canContinue = Boolean(
    preferenceFor(1) && form.rateMinDollars !== '' && form.rateMaxDollars !== '' && maxDollars > minDollars
  );

  const { attempted, handleNext } = useAttemptedNext(canContinue, onNext);

  return (
    <div>
      <h2 className="text-heading text-ink">Your services.</h2>
      <p className="mt-2 text-sm text-ink-3">
        Select your service preferences and set your consultation rate.
      </p>

      <div className="mt-7">
        <span className="mb-3 block text-mono-label text-ink-3">
          SERVICE PREFERENCES — RANK YOUR TOP 3
        </span>

        <div className="mb-4 flex flex-wrap gap-2">
          {(['all', 'taxation', 'legal', 'finance_advisory'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                categoryFilter === cat
                  ? 'border-ink bg-ink text-bg'
                  : 'border-line text-ink-3 hover:border-ink-3'
              }`}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Select
            label="1st Preference"
            value={preferenceFor(1)}
            onChange={(e) => setPreference(1, e.target.value)}
            required
            error={attempted && !preferenceFor(1) ? REQUIRED_MSG : undefined}
          >
            <option value="">Select service…</option>
            {visibleAreas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
            <Select
              label="2nd Preference"
              value={preferenceFor(2)}
              onChange={(e) => setPreference(2, e.target.value)}
            >
              <option value="">Select service…</option>
              {visibleAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <Select
              label="3rd Preference"
              value={preferenceFor(3)}
              onChange={(e) => setPreference(3, e.target.value)}
            >
              <option value="">Select service…</option>
              {visibleAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
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
          label="Min (USD / hour)"
          type="number"
          min={0}
          placeholder="e.g. 500"
          value={form.rateMinDollars}
          onChange={(e) => update({ rateMinDollars: e.target.value })}
          required
          error={attempted && form.rateMinDollars === '' ? REQUIRED_MSG : undefined}
        />
        <Input
          label="Max (USD / hour)"
          type="number"
          min={0}
          placeholder="e.g. 2000"
          value={form.rateMaxDollars}
          onChange={(e) => update({ rateMaxDollars: e.target.value })}
          required
          error={attempted && form.rateMaxDollars === '' ? REQUIRED_MSG : undefined}
        />
      </div>
      {form.rateMinDollars !== '' && form.rateMaxDollars !== '' && maxDollars <= minDollars && (
        <p className="mt-2 text-xs text-error">Max must be greater than min.</p>
      )}

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
