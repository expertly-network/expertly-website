// brain/time-keeper.spec.ts
import { describe, expect, it } from 'vitest';
import { phaseAt } from './time-keeper';

const MIN = 60;
const base = {
  engagement: 'normal' as const,
  openHighValueObjective: true,
  extension: { offeredAt: null, accepted: null },
};

describe('phaseAt', () => {
  it('is normal before 18 minutes', () => {
    expect(phaseAt({ ...base, elapsedSeconds: 17 * MIN })).toBe('normal');
  });
  it('winds down from 18 minutes', () => {
    expect(phaseAt({ ...base, elapsedSeconds: 18 * MIN })).toBe('wind_down');
  });
  it('offers an extension at 20–23 min when engaged and value remains', () => {
    expect(phaseAt({ ...base, engagement: 'high', elapsedSeconds: 21 * MIN })).toBe('offer_extension');
  });
  it('wraps up at 20+ min when not engaged', () => {
    expect(phaseAt({ ...base, engagement: 'normal', elapsedSeconds: 21 * MIN })).toBe('wrap_up');
  });
  it('wraps up at 20+ min when nothing high-value is open', () => {
    expect(phaseAt({ ...base, engagement: 'high', openHighValueObjective: false, elapsedSeconds: 21 * MIN })).toBe(
      'wrap_up'
    );
  });
  it('never offers twice', () => {
    const offered = { offeredAt: '2026-11-09T10:00:00Z', accepted: null };
    expect(phaseAt({ ...base, engagement: 'high', extension: offered, elapsedSeconds: 22 * MIN })).toBe('wrap_up');
  });
  it('does not offer after 23 minutes', () => {
    expect(phaseAt({ ...base, engagement: 'high', elapsedSeconds: 23.5 * 60 })).toBe('wrap_up');
  });
  it('is extended after an accepted offer, until 28 min', () => {
    const accepted = { offeredAt: '2026-11-09T10:00:00Z', accepted: true };
    expect(phaseAt({ ...base, extension: accepted, elapsedSeconds: 24 * MIN })).toBe('extended');
    expect(phaseAt({ ...base, extension: accepted, elapsedSeconds: 27 * MIN })).toBe('extended_closing');
    expect(phaseAt({ ...base, extension: accepted, elapsedSeconds: 28 * MIN })).toBe('wrap_up');
  });
  it('wraps up early once every priority-1/2 objective is covered', () => {
    expect(phaseAt({ ...base, openHighValueObjective: false, elapsedSeconds: 12 * MIN })).toBe('wrap_up');
  });
  it('winds down when the member is short on time, from any point', () => {
    expect(phaseAt({ ...base, memberShortOnTime: true, elapsedSeconds: 5 * MIN })).toBe('wind_down');
  });
  it('stops at 30 minutes', () => {
    expect(phaseAt({ ...base, elapsedSeconds: 30 * MIN })).toBe('stop');
  });
});
