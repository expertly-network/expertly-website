import { describe, expect, it, vi } from 'vitest';
import { countDistinctCountries, StatsService } from './stats.service';
import type { StatsRepository } from './stats.repository';

describe('countDistinctCountries', () => {
  it('ignores case, whitespace, blanks and Other', () => {
    expect(countDistinctCountries(['India', ' india ', 'INDIA', 'United  States', 'united states', '', 'Other'])).toBe(
      2
    );
  });
  it('is 0 for no members', () => {
    expect(countDistinctCountries([])).toBe(0);
  });
});

describe('StatsService', () => {
  it('assembles the four hero figures', async () => {
    const repo = {
      listActiveMemberCountries: vi.fn().mockResolvedValue(['India', 'India', 'Singapore']),
      countActiveCategories: vi.fn().mockResolvedValue(12),
      countConsultationRequests: vi.fn().mockResolvedValue(7),
    } as unknown as StatsRepository;
    await expect(new StatsService(repo).getPlatformStats()).resolves.toEqual({
      members: 3,
      jurisdictions: 2,
      practiceAreas: 12,
      consultations: 7,
    });
  });
});
