import { describe, expect, it } from 'vitest';
import { phaseAt } from './time-keeper';

describe('phaseAt', () => {
  it('is normal before 12 minutes', () => expect(phaseAt({ elapsedSeconds: 719 })).toBe('normal'));
  it('closes from 12 minutes', () => expect(phaseAt({ elapsedSeconds: 720 })).toBe('close'));
  it('stops at 17 minutes', () => expect(phaseAt({ elapsedSeconds: 1020 })).toBe('stop'));
});
