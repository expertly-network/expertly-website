// Pure time rules (spec §6.5). Elapsed time is wall-clock across all connections.
export type TimePhase = 'normal' | 'close' | 'stop';

export const CLOSE_AT_SECONDS = 12 * 60;
export const STOP_AT_SECONDS = 17 * 60;

export function phaseAt(t: { elapsedSeconds: number }): TimePhase {
  if (t.elapsedSeconds >= STOP_AT_SECONDS) return 'stop';
  if (t.elapsedSeconds >= CLOSE_AT_SECONDS) return 'close';
  return 'normal';
}
