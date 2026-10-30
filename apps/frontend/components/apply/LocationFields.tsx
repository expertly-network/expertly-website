'use client';

import { useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ImportedTag } from '@/components/apply/ImportedTag';
import { COUNTRIES, type WizardFormState } from '@/components/apply/types';
import { useLocationOptions } from '@/lib/location/useLocationOptions';

const OTHER = 'Other';
// The backend derives the business region from exactly this country list, so the cascading
// dropdown offers these (with their real states/cities) plus "Other" as a free-text escape hatch.
const SUPPORTED_COUNTRIES = COUNTRIES.filter((c) => c !== OTHER);

const optionalTag = <span className="text-xs font-normal text-ink-3">optional</span>;

// Country -> State -> City cascade. Changing a parent clears its children, and an imported child
// that doesn't belong to its parent is cleared too, so an unrelated combination (e.g. Texas +
// London) can never be submitted.
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
  const { loading, failed, countries, states, cities } = useLocationOptions(
    form.country,
    form.state,
    SUPPORTED_COUNTRIES
  );

  const isOther = form.country === OTHER;
  // Dataset unavailable (still loading or chunk failed) -> free text, so the form is never blocked.
  const freeText =
    isOther || failed || (!loading && form.country !== '' && countries.every((c) => c.name !== form.country));
  const hasStates = !freeText && states.length > 0;
  const stateKnown = states.some((s) => s.name === form.state);
  const cityKnown = cities.includes(form.city);

  const countryOptions = failed ? SUPPORTED_COUNTRIES : countries.map((c) => c.name);

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
      <Select
        id="country"
        label="Country"
        value={form.country}
        disabled={loading}
        onChange={(e) => {
          update({ country: e.target.value, state: '', city: '' });
          onCountryChange?.();
        }}
        error={countryError}
        required
      >
        <option value="">{loading ? 'Loading countries…' : 'Select country…'}</option>
        {countryOptions.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        {/* An imported country outside the supported list stays visible so the applicant can change it. */}
        {form.country && form.country !== OTHER && !loading && !countryOptions.includes(form.country) && (
          <option value={form.country}>{form.country}</option>
        )}
        <option value={OTHER}>{OTHER}</option>
      </Select>

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
          <Select
            id="state"
            label="State / Province"
            value={form.state}
            disabled={!form.country || !hasStates}
            onChange={(e) => update({ state: e.target.value, city: '' })}
          >
            <option value="">
              {!form.country ? 'Select a country first' : hasStates ? 'Select state…' : 'No states for this country'}
            </option>
            {states.map((s) => (
              <option key={s.isoCode} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
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
          <Select
            id="city"
            label="City"
            value={form.city}
            disabled={!form.country || (hasStates && !form.state)}
            onChange={(e) => update({ city: e.target.value })}
          >
            <option value="">
              {!form.country
                ? 'Select a country first'
                : hasStates && !form.state
                  ? 'Select a state first'
                  : 'Select city…'}
            </option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        )}
      </div>
    </>
  );
}
