import { describe, expect, it } from 'vitest';
import { Country } from 'country-state-city';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import { DATASET_NAME_BY_COUNTRY } from './dataset-aliases';
import { toCountryOptions } from './location-data';

describe('country options', () => {
  const options = toCountryOptions(Country.getAllCountries(), ALL_COUNTRIES);

  it('offers every canonical country, under its canonical name, with a dataset ISO code', () => {
    expect(options.map((o) => o.name).sort()).toEqual([...ALL_COUNTRIES].sort());
    expect(options.every((o) => /^[A-Z]{2}$/.test(o.isoCode))).toBe(true);
  });

  it('bridges the spellings the dataset uses for the aliased countries', () => {
    const iso = Object.fromEntries(options.map((o) => [o.name, o.isoCode]));
    expect(iso['Czechia']).toBe('CZ');
    expect(iso['Ivory Coast']).toBe('CI');
    expect(iso['North Macedonia']).toBe('MK');
    expect(iso['Timor-Leste']).toBe('TL');
    expect(iso['Vatican City']).toBe('VA');
  });

  it('only aliases names the dataset actually spells differently', () => {
    const datasetNames = new Set(Country.getAllCountries().map((c) => c.name));
    for (const [canonical, dataset] of Object.entries(DATASET_NAME_BY_COUNTRY)) {
      expect(datasetNames.has(canonical), `${canonical} needs no alias`).toBe(false);
      expect(datasetNames.has(dataset), `${dataset} is not a dataset name`).toBe(true);
    }
  });
});
