import { describe, expect, it } from 'vitest';
import { addConsistencyFlags } from './consistency-checks';
import type { MemberContext, ModelClaim } from './types';

const member = (o: Partial<MemberContext> = {}): MemberContext => ({
  memberId: 'm',
  firstName: 'A',
  headline: null,
  bio: null,
  yearsOfExperience: 10,
  city: null,
  country: null,
  firmName: null,
  workExperiences: [
    { title: 'Partner', company: 'X', startYear: 2010, endYear: 2015, isCurrent: false },
    { title: 'Founder', company: 'Y', startYear: 2016, isCurrent: true },
  ],
  educations: [],
  engagements: [],
  keyClients: [],
  services: [],
  ...o,
});
const claim = (o: Partial<ModelClaim>): ModelClaim => ({
  id: 'c1',
  text: 'x',
  serviceIds: [],
  type: 'engagement',
  periodFrom: null,
  periodTo: null,
  source: 'bio',
  ...o,
});

describe('addConsistencyFlags', () => {
  it('flags GST work before 2017', () => {
    const [c] = addConsistencyFlags([claim({ text: 'GST litigation for exporters', periodFrom: 2014 })], member());
    expect(c.flags).toContain('regime_before_start');
  });
  it('does not flag GST work from 2018', () => {
    const [c] = addConsistencyFlags([claim({ text: 'GST audits', periodFrom: 2018 })], member());
    expect(c.flags).not.toContain('regime_before_start');
  });
  it('flags claims outside the career span (1-year tolerance)', () => {
    const [early] = addConsistencyFlags([claim({ periodFrom: 2005 })], member());
    expect(early.flags).toContain('timeline_conflict');
    const [ok] = addConsistencyFlags([claim({ periodFrom: 2009 })], member());
    expect(ok.flags).not.toContain('timeline_conflict');
  });
  it('flags a claim ending after the career when nothing is current', () => {
    const m = member({ workExperiences: [{ startYear: 2010, endYear: 2015, isCurrent: false }] });
    const [c] = addConsistencyFlags([claim({ periodFrom: 2012, periodTo: 2020 })], m);
    expect(c.flags).toContain('timeline_conflict');
  });
  it('flags selected services the profile does not support', () => {
    const [c] = addConsistencyFlags([claim({ source: 'selected_service' })], member());
    expect(c.flags).toEqual(['selected_no_evidence']);
  });
  it('skips the timeline check without work history', () => {
    const [c] = addConsistencyFlags([claim({ periodFrom: 1990 })], member({ workExperiences: [] }));
    expect(c.flags).toEqual([]);
  });
});
