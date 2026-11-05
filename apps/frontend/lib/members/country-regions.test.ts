import { describe, expect, it } from 'vitest';
import { ALL_COUNTRIES } from './countries';
import { REGION_COUNTRIES, countriesInRegions } from './country-regions';

describe('country regions', () => {
  it('places every country in exactly one region, and nothing outside the list', () => {
    const placed = Object.values(REGION_COUNTRIES).flat();
    expect([...placed].sort()).toEqual([...ALL_COUNTRIES].sort());
  });

  it('filters to the selected regions, or returns everything with none selected', () => {
    expect(countriesInRegions(['south_asia'])).toEqual([
      'Afghanistan',
      'Bangladesh',
      'Bhutan',
      'India',
      'Maldives',
      'Nepal',
      'Pakistan',
      'Sri Lanka',
    ]);
    expect(countriesInRegions(['north_america', 'south_asia'])).toContain('Canada');
    expect(countriesInRegions([])).toHaveLength(ALL_COUNTRIES.length);
  });
});
