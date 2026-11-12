import { describe, expect, it } from 'vitest';
import { backgroundErrors } from './background-errors';

const role = {
  title: 'Partner',
  company: 'Firm',
  companyUrl: 'https://firm.example',
  firmSize: '2_10' as const,
  startYear: 2020,
  isCurrent: true,
};
const edu = { institution: 'Uni', degree: 'LLB' };

describe('backgroundErrors', () => {
  it('passes a complete background', () => {
    expect(backgroundErrors({ yearsOfExperience: '12', workExperiences: [role], educations: [edu] })).toEqual({});
  });

  it('flags missing years, title and degree', () => {
    const e = backgroundErrors({
      yearsOfExperience: '',
      workExperiences: [{ ...role, title: '' }],
      educations: [{ ...edu, degree: '' }],
    });
    expect(e.yearsOfExperience).toBeDefined();
    expect(e['workExperiences.0.title']).toBeDefined();
    expect(e['educations.0.degree']).toBeDefined();
  });

  it("requires the current company's size and website", () => {
    const e = backgroundErrors({
      yearsOfExperience: '12',
      workExperiences: [{ ...role, firmSize: undefined, companyUrl: undefined }],
      educations: [edu],
    });
    expect(e['workExperiences.0.firmSize']).toBeDefined();
    expect(e['workExperiences.0.companyUrl']).toBeDefined();
  });

  it('flags an end date before the start date', () => {
    const e = backgroundErrors({
      yearsOfExperience: '12',
      workExperiences: [role, { ...role, company: 'Past', isCurrent: false, startYear: 2018, endYear: 2016 }],
      educations: [edu],
    });
    expect(e['workExperiences.1.dates']).toBe('End date is before the start date.');
  });

  it('requires a current position', () => {
    expect(
      backgroundErrors({
        yearsOfExperience: '12',
        workExperiences: [{ ...role, isCurrent: false, endYear: 2024 }],
        educations: [edu],
      }).workExperiencesCurrent
    ).toBeDefined();
  });
});
