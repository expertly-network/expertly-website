import { Injectable } from '@nestjs/common';
import type { PlatformStatsResponse } from '@shared/platform-stats';
import { StatsRepository } from './stats.repository';

/** Distinct, ignoring case and surrounding/inner whitespace; blanks and 'Other' name no place. */
export function countDistinctCountries(countries: string[]): number {
  const seen = new Set<string>();
  for (const raw of countries) {
    const key = raw.trim().replace(/\s+/g, ' ').toLowerCase();
    if (key && key !== 'other') seen.add(key);
  }
  return seen.size;
}

@Injectable()
export class StatsService {
  constructor(private readonly repository: StatsRepository) {}

  async getPlatformStats(): Promise<PlatformStatsResponse> {
    const [countries, practiceAreas, consultations] = await Promise.all([
      this.repository.listActiveMemberCountries(),
      this.repository.countActiveCategories(),
      this.repository.countConsultationRequests(),
    ]);
    return {
      members: countries.length,
      jurisdictions: countDistinctCountries(countries),
      practiceAreas,
      consultations,
    };
  }
}
