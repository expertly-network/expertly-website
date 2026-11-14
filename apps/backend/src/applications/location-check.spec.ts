import { describe, expect, it } from 'vitest';
import { Country } from 'country-state-city';
import { COUNTRY_TO_REGION } from './constants/country-region';
import { DATASET_NAME_BY_COUNTRY, datasetCountryName } from './constants/country-dataset-aliases';
import { findLocationMismatch } from './location-check';

describe('findLocationMismatch', () => {
  it('passes a consistent country / state / city from the dataset', () => {
    expect(findLocationMismatch('Mexico', 'Jalisco', 'Guadalajara')).toBeNull();
    expect(findLocationMismatch('Sri Lanka', 'Western Province', null)).toBeNull();
    expect(findLocationMismatch('India', 'Karnataka', 'Bengaluru')).toBeNull();
  });

  it('rejects a state or city that belongs elsewhere', () => {
    expect(findLocationMismatch('Mexico', 'Texas', null)).toMatch(/state "Texas" is not in Mexico/);
    expect(findLocationMismatch('United States', 'Texas', 'London')).toMatch(
      /city "London" is not in Texas, United States/
    );
  });

  it('checks the aliased countries under their canonical names', () => {
    expect(findLocationMismatch('Czechia', 'Praha, Hlavní město', null)).toBeNull();
    expect(findLocationMismatch('Czechia', 'Bavaria', null)).toMatch(/state "Bavaria" is not in Czechia/);
    expect(findLocationMismatch('Ivory Coast', 'Abidjan', null)).toBeNull();
  });

  it('cannot check Other or an unknown name, so it passes them', () => {
    expect(findLocationMismatch('Other', 'Anywhere', 'Town')).toBeNull();
    expect(findLocationMismatch('Atlantis', 'Deep', 'Reef')).toBeNull();
    expect(findLocationMismatch(null, 'x', 'y')).toBeNull();
  });
});

describe('country-dataset aliases', () => {
  const datasetNames = new Set(Country.getAllCountries().map((c) => c.name));

  it('resolve every region-mapped country to a dataset country', () => {
    const unresolved = Object.keys(COUNTRY_TO_REGION).filter((c) => !datasetNames.has(datasetCountryName(c)));
    expect(unresolved).toEqual([]);
  });

  it('only alias names the dataset actually spells differently', () => {
    for (const [canonical, dataset] of Object.entries(DATASET_NAME_BY_COUNTRY)) {
      expect(datasetNames.has(canonical), `${canonical} needs no alias`).toBe(false);
      expect(datasetNames.has(dataset), `${dataset} is not a dataset name`).toBe(true);
      expect(COUNTRY_TO_REGION[canonical], `${canonical} has no region`).toBeDefined();
    }
  });
});
