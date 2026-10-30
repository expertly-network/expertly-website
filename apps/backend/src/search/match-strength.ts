import { MATCH_STRENGTH } from './search.config';
import type { SearchMatchDto } from '@shared/search';

/**
 * Turns the judge's raw 0-10 score into the label and tier shown to the user. Uses the RAW judge
 * score, not the practice-area floor of 7 applied in the service (that floor decides what is kept,
 * and would make a weak topical match look 'strong').
 */
export function matchStrength(
  rawScore: number,
  cut: { strong: number; good: number } = MATCH_STRENGTH
): SearchMatchDto {
  const score = Math.min(10, Math.max(0, Math.round(Number.isFinite(rawScore) ? rawScore : 0)));
  const label = score >= cut.strong ? 'strong' : score >= cut.good ? 'good' : 'possible';
  return { score, label, tier: label === 'possible' ? 'related' : 'best' };
}
