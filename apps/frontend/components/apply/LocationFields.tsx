'use client';

import { useEffect } from 'react';
import { Combobox, type ComboboxOption } from '@/components/ui/Combobox';
import { Input } from '@/components/ui/Input';
import { ImportedTag } from '@/components/apply/ImportedTag';
import type { WizardFormState } from '@/components/apply/types';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { useLocationOptions } from '@/lib/location/useLocationOptions';

const OTHER = 'Other';

const optionalTag = <span className="text-xs font-normal text-ink-3">optional</span>;

const toOptions = (names: readonly string[]): ComboboxOption[] => names.map((n) => ({ value: n, label: n }));

// Country -> State -> City cascade, each a searchable list (country-state-city dataset). Country
// offers every country in ALL_COUNTRIES — the same canonical names the backend's region map and
// the member-directory filter use (2026-11-14; it used to be an 18-country shortlist, which
// stranded applicants whose LinkedIn import brought in e.g. Mexico or Sri Lanka) — plus "Other" as
// a free-text escape hatch. Changing a parent clears its children, and an imported child that
// doesn't belong to its parent is cleared too, so an unrelated combination (e.g. Texas + London)
// can never be submitted.
export function LocationFields({
  form,
  update,
  countryError,
  onCountryChange,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  countryError?: string;
  onCountryChange?: () => void;
}) {
  const { loading, failed, countries, states, cities } = useLocationOptions(form.country, form.state, ALL_COUNTRIES);

  const isOther = form.country === OTHER;
  // Dataset unavailable (still loading or chunk failed) -> free text, so the form is never blocked.
  const freeText =
    isOther || failed || (!loading && form.country !== '' && countries.every((c) => c.name !== form.country));
  const hasStates = !freeText && states.length > 0;
  const stateKnown = states.some((s) => s.name === form.state);
  const cityKnown = cities.includes(form.city);

  const countryNames = failed ? ALL_COUNTRIES : countries.map((c) => c.name);
  // An imported country outside the list stays visible so the applicant can change it.
  const importedUnknown = form.country && form.country !== OTHER && !loading && !countryNames.includes(form.country);
  const countryOptions = toOptions([...countryNames, ...(importedUnknown ? [form.country] : []), OTHER]);

  // A LinkedIn-imported state/city that doesn't belong to the selected country (or state) is
  // cleared rather than kept as an extra option — the backend rejects the mismatch at submit.
  const staleState = !freeText && Boolean(form.state) && (!hasStates || !stateKnown);
  const staleCity = !freeText && Boolean(form.city) && cities.length > 0 && !cityKnown;
  useEffect(() => {
    if (loading) return;
    if (staleState) update({ state: '', city: '' });
    else if (staleCity) update({ city: '' });
  }, [loading, staleState, staleCity, update]);

  return (
    <>
      <Combobox
        id="country"
        label="Country"
        markRequired
        value={form.country}
        disabled={loading}
        onChange={(country) => {
          update({ country, state: '', city: '' });
          onCountryChange?.();
        }}
        options={countryOptions}
        placeholder={loading ? 'Loading countries…' : 'Select country…'}
        searchPlaceholder="Search countries, e.g. Mexico"
        emptyText="No country matches — pick “Other” and type it in."
        error={countryError}
      />

      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        {freeText ? (
          <Input
            label="State / Province"
            labelRight={optionalTag}
            name="state"
            placeholder="e.g. California"
            value={form.state}
            onChange={(e) => update({ state: e.target.value })}
          />
        ) : (
          <Combobox
            id="state"
            label="State / Province"
            value={form.state}
            disabled={!form.country || !hasStates}
            onChange={(state) => update({ state, city: '' })}
            options={toOptions(states.map((s) => s.name))}
            placeholder={
              !form.country ? 'Select a country first' : hasStates ? 'Select state…' : 'No states for this country'
            }
            searchPlaceholder="Search states…"
            emptyText="No state matches."
            clearable
          />
        )}

        {freeText || (cities.length === 0 && (!hasStates || stateKnown)) ? (
          <Input
            label="City"
            labelRight={form.importedFields.has('city') ? <ImportedTag /> : optionalTag}
            name="city"
            placeholder="e.g. London"
            value={form.city}
            onChange={(e) => update({ city: e.target.value })}
          />
        ) : (
          <Combobox
            id="city"
            label="City"
            value={form.city}
            disabled={!form.country || (hasStates && !form.state)}
            onChange={(city) => update({ city })}
            options={toOptions(cities)}
            placeholder={
              !form.country
                ? 'Select a country first'
                : hasStates && !form.state
                  ? 'Select a state first'
                  : 'Select city…'
            }
            searchPlaceholder="Search cities…"
            emptyText="No city matches."
            clearable
          />
        )}
      </div>
    </>
  );
}
