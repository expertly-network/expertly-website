// Pure time rules (spec §4.5). Elapsed time is wall-clock across all connections.
export type TimePhase =
  | 'normal'
  | 'wind_down'
  | 'offer_extension'
  | 'extended'
  | 'extended_closing' // extended, past 26 min: no new long story
  | 'wrap_up'
  | 'stop';

export interface TimeInput {
  elapsedSeconds: number;
  engagement: 'high' | 'normal' | 'low';
  /** A priority-1 or -2 objective is still open. */
  openHighValueObjective: boolean;
  extension: { offeredAt: string | null; accepted: boolean | null };
  memberShortOnTime?: boolean;
}

const MIN = 60;

export function phaseAt(t: TimeInput): TimePhase {
  const e = t.elapsedSeconds;
  if (e >= 30 * MIN) return 'stop';
  if (e >= 28 * MIN) return 'wrap_up';
  if (!t.openHighValueObjective) return 'wrap_up';
  if (t.extension.accepted === true && e >= 20 * MIN) return e >= 26 * MIN ? 'extended_closing' : 'extended';
  if (e >= 20 * MIN) {
    const canOffer =
      e < 23 * MIN && t.extension.offeredAt === null && t.engagement === 'high' && t.openHighValueObjective;
    return canOffer ? 'offer_extension' : 'wrap_up';
  }
  if (t.memberShortOnTime || e >= 18 * MIN) return 'wind_down';
  return 'normal';
}
