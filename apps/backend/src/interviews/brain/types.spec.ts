import { describe, expect, it } from 'vitest';
import { emptyStateV2, parseStateV2, preparerOutputSchema, trackerUpdateSchema } from './types';

describe('brain types v2', () => {
  it('parseStateV2 fills defaults and ignores v1 documents', () => {
    expect(parseStateV2(null)).toEqual(emptyStateV2());
    const v1 = { version: 1, facts: {}, currentObjectiveId: 'e1' };
    expect(parseStateV2(v1)).toEqual(emptyStateV2());
    const v2 = { ...emptyStateV2(), currentClaimId: 'c2', step: 3 };
    expect(parseStateV2(v2)).toMatchObject({ currentClaimId: 'c2', step: 3 });
  });
  it('preparer output requires claim ids of the form cN', () => {
    const ok = preparerOutputSchema.safeParse({
      claims: [
        {
          id: 'c1',
          text: 'Transfer pricing for MNC captives',
          serviceIds: [],
          type: 'specialisation',
          periodFrom: 2015,
          periodTo: null,
          source: 'bio',
        },
      ],
      baselineClaimId: 'c1',
      claimIds: ['c1'],
      opening: 'Pick one transfer pricing engagement from the last three years. What kind of entity was it?',
    });
    expect(ok.success).toBe(true);
    const bad = preparerOutputSchema.safeParse({
      claims: [{ id: 'x' }],
      baselineClaimId: 'x',
      claimIds: [],
      opening: '',
    });
    expect(bad.success).toBe(false);
  });
  it('tracker update is fully required (strict-schema safe)', () => {
    const parsed = trackerUpdateSchema.safeParse({ stepCovered: true });
    expect(parsed.success).toBe(false);
  });
});
