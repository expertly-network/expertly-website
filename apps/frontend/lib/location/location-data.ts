import type { ICity, ICountry, IState } from 'country-state-city';

// The dataset is large (~several MB of JSON) — loaded on demand via dynamic import so it never
// lands in the initial bundle, only when the identity step actually renders location fields.
type Dataset = typeof import('country-state-city');

let datasetPromise: Promise<Dataset> | null = null;

export function loadLocationDataset(): Promise<Dataset> {
  if (!datasetPromise) {
    datasetPromise = import('country-state-city').catch((err: unknown) => {
      datasetPromise = null; // allow a retry after a transient chunk-load failure
      throw err;
    });
  }
  return datasetPromise;
}

export interface LocationOption {
  name: string;
  isoCode: string;
}

export function toCountryOptions(countries: ICountry[], allowedNames: readonly string[]): LocationOption[] {
  return countries
    .filter((c) => allowedNames.includes(c.name))
    .map((c) => ({ name: c.name, isoCode: c.isoCode }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function toStateOptions(states: IState[]): LocationOption[] {
  return states.map((s) => ({ name: s.name, isoCode: s.isoCode })).sort((a, b) => a.name.localeCompare(b.name));
}

export function toCityNames(cities: ICity[]): string[] {
  return Array.from(new Set(cities.map((c) => c.name))).sort((a, b) => a.localeCompare(b));
}
