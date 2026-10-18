'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  loadLocationDataset,
  toCityNames,
  toCountryOptions,
  toStateOptions,
  type LocationOption,
} from '@/lib/location/location-data';

type Dataset = Awaited<ReturnType<typeof loadLocationDataset>>;

export interface LocationOptions {
  loading: boolean;
  failed: boolean;
  countries: LocationOption[];
  /** States of the selected country; empty when the country has none (or none is selected). */
  states: LocationOption[];
  /** Cities of the selected state, or of the whole country when it has no states. */
  cities: string[];
}

// Resolves the cascading Country -> State -> City option lists for the currently selected names.
// Names (not ISO codes) are what the application stores, so they are looked up here.
export function useLocationOptions(
  country: string,
  state: string,
  allowedCountries: readonly string[]
): LocationOptions {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLocationDataset()
      .then((d) => {
        if (!cancelled) setDataset(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const countries = useMemo(
    () => (dataset ? toCountryOptions(dataset.Country.getAllCountries(), allowedCountries) : []),
    [dataset, allowedCountries]
  );

  const countryIso = countries.find((c) => c.name === country)?.isoCode;

  const states = useMemo(
    () => (dataset && countryIso ? toStateOptions(dataset.State.getStatesOfCountry(countryIso)) : []),
    [dataset, countryIso]
  );

  const stateIso = states.find((s) => s.name === state)?.isoCode;

  const cities = useMemo(() => {
    if (!dataset || !countryIso) return [];
    if (states.length === 0) return toCityNames(dataset.City.getCitiesOfCountry(countryIso) ?? []);
    if (!stateIso) return [];
    return toCityNames(dataset.City.getCitiesOfState(countryIso, stateIso));
  }, [dataset, countryIso, states.length, stateIso]);

  return { loading: !dataset && !failed, failed, countries, states, cities };
}
