// interview-eligibility.spec.ts
import { describe, expect, it } from 'vitest';
import { eligibilityOf } from './interview-eligibility';
import type { InterviewRow } from './interviews.repository';

const NOW = Date.parse('2026-11-09T12:00:00Z');
function row(overrides: Partial<InterviewRow>): InterviewRow {
  return { status: 'ready', elapsedSeconds: 0, reconnectUntil: null, ...overrides } as InterviewRow;
}

describe('eligibilityOf', () => {
  it('available with no interview', () => expect(eligibilityOf(null, false, NOW, 1800)).toBe('available'));
  it('available when planned but never connected', () =>
    expect(eligibilityOf(row({ status: 'ready' }), false, NOW, 1800)).toBe('available'));
  it('in_progress with a live connection', () =>
    expect(eligibilityOf(row({ status: 'in_progress' }), true, NOW, 1800)).toBe('in_progress'));
  it('can_reconnect inside the window', () =>
    expect(
      eligibilityOf(row({ status: 'interrupted', reconnectUntil: '2026-11-10T00:00:00Z', elapsedSeconds: 600 }), false, NOW, 1800)
    ).toBe('can_reconnect'));
  it('processing once the window passed', () =>
    expect(eligibilityOf(row({ status: 'interrupted', reconnectUntil: '2026-11-09T11:00:00Z' }), false, NOW, 1800)).toBe('processing'));
  it('processing when the time is used up', () =>
    expect(
      eligibilityOf(row({ status: 'interrupted', reconnectUntil: '2026-11-10T00:00:00Z', elapsedSeconds: 1800 }), false, NOW, 1800)
    ).toBe('processing'));
  it.each(['processing', 'completed', 'failed'] as const)('%s maps to itself', (status) =>
    expect(eligibilityOf(row({ status }), false, NOW, 1800)).toBe(status));
});
