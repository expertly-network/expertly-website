import { describe, expect, it } from 'vitest';
import type { ApplicationDto } from '@shared/membership-application';
import { formFromApplication, profileOverrides } from './profile-overrides';

const app = {
  firstName: 'Alex',
  lastName: 'Morgan',
  contactEmail: 'a@x.co',
  workEmail: 'old@w.co',
  phoneCountryCode: '+91',
  phone: '98765',
  region: 'south_asia',
  country: 'India',
  state: 'KA',
  city: 'Blr',
  linkedinUrl: null,
  bio: 'Bio',
  yearsOfExperience: 10,
  rateMinCents: 2000,
  rateMaxCents: 10000,
  workExperiences: [{ title: 'Partner', company: 'Firm', startYear: 2020, isCurrent: true }],
  educations: [{ institution: 'Uni', degree: 'LLB' }],
  peerReferences: [],
  servicePreferences: [],
  billingPeriod: 'annual',
  couponCode: null,
  linkedinImportConsent: false,
  photoUrl: null,
} as unknown as ApplicationDto;

describe('profileOverrides', () => {
  it('is empty when nothing changed', () => {
    expect(profileOverrides(app, formFromApplication(app))).toEqual({});
  });

  it('returns only the changed fields, in API units', () => {
    const form = { ...formFromApplication(app), workEmail: 'new@w.co', yearsOfExperience: '14', rateMaxDollars: '150' };
    expect(profileOverrides(app, form)).toEqual({ workEmail: 'new@w.co', yearsOfExperience: 14, rateMaxCents: 15000 });
  });

  it('sends the whole array when one education changes', () => {
    const edited = { ...formFromApplication(app), educations: [{ institution: 'NLSIU', degree: 'LLM' }] };
    expect(profileOverrides(app, edited)).toEqual({ educations: [{ institution: 'NLSIU', degree: 'LLM' }] });
  });
});
