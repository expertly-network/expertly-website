import { describe, expect, it } from 'vitest';
import { isFullyVerified } from './fully-verified';
import type { MemberDto } from '@shared/member';

const verified = { isVerified: true };
const base = {
  isVerified: true,
  contactVerified: true,
  engagements: [verified],
  educations: [verified],
  workExperiences: [verified, verified],
  keyClients: [verified],
  testimonials: [],
  awards: [verified],
} as unknown as MemberDto;

describe('isFullyVerified', () => {
  it('is true when the admin approved the profile and nothing is pending', () => {
    expect(isFullyVerified(base)).toBe(true);
  });
  it('is false while any entry is pending', () => {
    expect(isFullyVerified({ ...base, awards: [verified, { isVerified: false }] } as unknown as MemberDto)).toBe(false);
  });
  it('is false while the contact block is pending', () => {
    expect(isFullyVerified({ ...base, contactVerified: false })).toBe(false);
  });
  it('is false without the whole-profile approval', () => {
    expect(isFullyVerified({ ...base, isVerified: false })).toBe(false);
  });
});
