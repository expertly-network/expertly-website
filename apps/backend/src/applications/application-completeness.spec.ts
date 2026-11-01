import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { incompleteEntryFields } from './application-completeness';
import { PeerReferenceDto } from './dto/peer-reference.dto';
import { WorkExperienceDto } from './dto/work-experience.dto';

const complete = {
  phone: '7700 900 000',
  work_experiences: [{ title: 'Partner', company: 'Acme LLP', startYear: 2018, isCurrent: true }],
  educations: [{ institution: 'NLS', degree: 'LLB' }],
  peer_references: [
    { name: 'A', relationship: 'Former manager', email: 'a@example.com' },
    { name: 'B', relationship: 'Peer', email: 'b@example.com' },
  ],
};

describe('incompleteEntryFields (submit)', () => {
  it('passes a complete application', () => {
    expect(incompleteEntryFields(complete)).toEqual([]);
  });

  it('requires a phone with a plausible digit count', () => {
    expect(incompleteEntryFields({ ...complete, phone: null })).toEqual(['phone']);
    expect(incompleteEntryFields({ ...complete, phone: '  ' })).toEqual(['phone']);
    expect(incompleteEntryFields({ ...complete, phone: '123' })).toEqual(['phone (6-15 digits)']);
    expect(incompleteEntryFields({ ...complete, phone: '+44 (0) 7700-900 000' })).toEqual([]);
  });

  it('flags half-filled entries a draft was allowed to keep', () => {
    expect(
      incompleteEntryFields({
        ...complete,
        work_experiences: [{ title: 'Partner', company: ' ' }],
        educations: [{ institution: 'NLS', degree: '' }],
        peer_references: [{ name: 'A', relationship: '', email: 'not-an-email' }, complete.peer_references[1]],
      })
    ).toEqual([
      'workExperiences[0].company',
      'educations[0].degree',
      'peerReferences[0].relationship',
      'peerReferences[0].email',
    ]);
  });
});

describe('incompleteEntryFields — founding-cohort pre-launch', () => {
  it('requires exactly two references once launched', () => {
    expect(incompleteEntryFields({ ...complete, peer_references: [] })).toEqual([
      'peerReferences (exactly 2 required)',
    ]);
  });

  it('skips references entirely when they are not collected', () => {
    expect(incompleteEntryFields({ ...complete, peer_references: [] }, { requirePeerReferences: false })).toEqual([]);
    expect(
      incompleteEntryFields(
        { ...complete, peer_references: [{ name: 'A', relationship: '', email: 'x' }] },
        { requirePeerReferences: false }
      )
    ).toEqual([]);
  });
});

describe('draft DTOs', () => {
  it('accept a half-filled peer reference, but not a malformed email', () => {
    const errs = (body: object) => validateSync(plainToInstance(PeerReferenceDto, body)).map((e) => e.property);
    expect(errs({ name: 'A', relationship: '', email: '' })).toEqual([]);
    expect(errs({ name: 'A', relationship: '', email: 'nope' })).toEqual(['email']);
  });

  it('accept a work card with only a title', () => {
    const errors = validateSync(
      plainToInstance(WorkExperienceDto, { title: 'Partner', company: '', startYear: 2020, isCurrent: false })
    );
    expect(errors).toEqual([]);
  });
});
