import { describe, expect, it } from 'vitest';
import { COUNTRY_TO_REGION, deriveRegion } from './country-region';

describe('deriveRegion', () => {
  it('maps the countries the wizard dropdown offers', () => {
    expect(deriveRegion('India')).toBe('south_asia');
    expect(deriveRegion('United States')).toBe('north_america');
    expect(deriveRegion('Brazil')).toBe('latin_america');
    expect(deriveRegion('Egypt')).toBe('africa');
  });

  it('maps countries that only arrive via the LinkedIn import (2026-11-14 regression)', () => {
    // Both blocked real applicants from submitting: no region -> "Location" incomplete.
    expect(deriveRegion('Mexico')).toBe('latin_america');
    expect(deriveRegion('Sri Lanka')).toBe('south_asia');
    expect(deriveRegion('Netherlands')).toBe('europe');
    expect(deriveRegion('Kenya')).toBe('africa');
    expect(deriveRegion('Vietnam')).toBe('asia_pacific');
    expect(deriveRegion('Saudi Arabia')).toBe('middle_east');
  });

  it('returns null for Other, blank, or an unknown country', () => {
    expect(deriveRegion('Other')).toBeNull();
    expect(deriveRegion('')).toBeNull();
    expect(deriveRegion(null)).toBeNull();
    expect(deriveRegion(undefined)).toBeNull();
    expect(deriveRegion('Atlantis')).toBeNull();
  });

  it('covers every country in one region only', () => {
    const names = Object.keys(COUNTRY_TO_REGION);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeGreaterThan(190);
  });
});
