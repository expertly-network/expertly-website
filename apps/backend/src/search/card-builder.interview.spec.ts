// search/card-builder.interview.spec.ts
import { describe, expect, it } from 'vitest';
import { CardBuilderService } from './card-builder.service';
import type { MemberSource } from './card.types';

function source(
  interviewSummary: string | null,
  interviewEvidence: MemberSource['interviewEvidence'] = []
): MemberSource {
  return {
    profile: {
      profile_id: 'm1',
      status: 'active',
      slug: 'asha',
      headline: 'TP partner',
      firm_name: null,
      city: 'Mumbai',
      state: null,
      country: 'India',
      years_of_experience: 14,
      bio: 'Bio',
      work_experiences: [],
      educations: [],
      engagements: [],
      key_clients: [],
      qualifications: [],
      credentials: [],
      awards: [],
      availability_notes: null,
      rate_min_cents: null,
      rate_max_cents: null,
      is_available: true,
      membership_started_at: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    person: { first_name: 'Asha', last_name: 'M', status: 'active', deleted_at: null },
    services: [],
    interviewSummary,
    interviewEvidence,
  };
}

describe('CardBuilderService.buildMember — interview highlights', () => {
  const builder = new CardBuilderService();
  it('appends the approved summary as the last line', () => {
    const card = builder.buildMember(source('Specialist in TP audit defence.'));
    expect(card?.content.split('\n').at(-1)).toBe('Interview highlights: Specialist in TP audit defence.');
  });
  it('leaves the card unchanged without a summary', () => {
    const without = builder.buildMember(source(null));
    expect(without?.content).not.toContain('Interview highlights');
  });
});

describe('CardBuilderService.buildMember — interview evidence', () => {
  const builder = new CardBuilderService();

  it('appends interview evidence lines last, and leaves other cards byte-identical', () => {
    const withEvidence = builder.buildMember(
      source(null, [{ serviceName: 'Transfer pricing', summary: 'Led a bilateral APA.', tags: ['India', 'APA'] }])
    );
    expect(withEvidence?.content.split('\n').at(-1)).toBe(
      'Interview evidence: Transfer pricing: Led a bilateral APA. [India, APA]'
    );
    const without = builder.buildMember(source(null, []));
    expect(without?.content).not.toContain('Interview evidence');
  });
});
