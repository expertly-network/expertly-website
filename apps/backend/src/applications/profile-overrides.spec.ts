import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { ApplicationRow } from './applications.repository';
import { ProfileOverridesDto } from './dto/profile-overrides.dto';
import { applyProfileOverrides, resolveMemberTier } from './profile-overrides';

const row = {
  id: 'app-1',
  first_name: 'Alex',
  last_name: 'Morgan',
  work_email: 'old@work.example',
  country: null,
  years_of_experience: 10,
  selected_tier: 'budding_entrepreneur',
  rate_min_cents: 2000,
  rate_max_cents: 10000,
  work_experiences: [{ title: 'Associate', company: 'Old', startYear: 2015, isCurrent: true }],
  educations: [{ institution: 'Uni', degree: 'LLB' }],
} as unknown as ApplicationRow;

describe('applyProfileOverrides', () => {
  it('returns the row unchanged (but a copy) when there are no overrides', () => {
    const merged = applyProfileOverrides(row, undefined);
    expect(merged).toEqual(row);
    expect(merged).not.toBe(row);
  });

  it('maps camelCase overrides onto snake_case columns without touching the original', () => {
    const merged = applyProfileOverrides(row, {
      workEmail: 'new@work.example',
      country: 'India',
      yearsOfExperience: 14,
      educations: [{ institution: 'NLSIU', degree: 'LLM' }],
    });
    expect(merged.work_email).toBe('new@work.example');
    expect(merged.country).toBe('India');
    expect(merged.years_of_experience).toBe(14);
    expect(merged.educations).toEqual([{ institution: 'NLSIU', degree: 'LLM' }]);
    expect(merged.first_name).toBe('Alex');
    expect(row.work_email).toBe('old@work.example');
    expect(row.country).toBeNull();
  });
});

describe('resolveMemberTier', () => {
  it('prefers an explicit tier', () => {
    expect(resolveMemberTier(row, 'seasoned_professional', { yearsOfExperience: 6 })).toBe('seasoned_professional');
  });
  it('recomputes from overridden years when no explicit tier', () => {
    expect(resolveMemberTier(row, undefined, { yearsOfExperience: 14 })).toBe('seasoned_professional');
  });
  it("falls back to the application's tier", () => {
    expect(resolveMemberTier(row, undefined, undefined)).toBe('budding_entrepreneur');
  });
});

describe('ProfileOverridesDto validation', () => {
  it('accepts a valid partial body', async () => {
    const dto = plainToInstance(ProfileOverridesDto, { workEmail: 'a@b.co', yearsOfExperience: 12 });
    expect(await validate(dto, { forbidNonWhitelisted: true, whitelist: true })).toHaveLength(0);
  });
  it('rejects a bad email and an unknown key', async () => {
    const dto = plainToInstance(ProfileOverridesDto, { workEmail: 'nope', couponCode: 'X' });
    const errors = await validate(dto, { forbidNonWhitelisted: true, whitelist: true });
    expect(errors.map((e) => e.property).sort()).toEqual(['couponCode', 'workEmail']);
  });
});
