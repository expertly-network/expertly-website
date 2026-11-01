import { describe, expect, it } from 'vitest';
import { careerYears } from './work-history';

const now = new Date(2026, 10, 1); // Nov 2026

describe('careerYears', () => {
  it('counts whole years from the earliest started role to today, gaps included', () => {
    expect(
      careerYears(
        [
          { title: 'Partner', company: 'A', startYear: 2018, startMonth: 3, isCurrent: true },
          { title: 'Associate', company: 'B', startYear: 2011, startMonth: 3, endYear: 2014, isCurrent: false },
        ],
        now
      )
    ).toBe(15);
  });

  it('rounds down a part year', () => {
    expect(careerYears([{ title: 'Analyst', startYear: 2025, startMonth: 12, isCurrent: true }], now)).toBe(0);
    expect(careerYears([{ title: 'Analyst', startYear: 2020, startMonth: 12, isCurrent: true }], now)).toBe(5);
  });

  it('ignores blank template cards and returns null with nothing to go on', () => {
    expect(careerYears([{ title: '', company: '', startYear: 2026, isCurrent: false }], now)).toBeNull();
    expect(careerYears([], now)).toBeNull();
  });
});
