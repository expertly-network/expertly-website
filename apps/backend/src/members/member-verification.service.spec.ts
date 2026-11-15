import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { itemLabel, MemberVerificationService } from './member-verification.service';
import type { MembersRepository } from './members.repository';

const MEMBER_ID = '22222222-2222-4222-8222-222222222222';

function setup(rowOverrides: Record<string, unknown> = {}) {
  const row = {
    profile_id: MEMBER_ID,
    slug: 'jane-doe',
    work_email: 'work@doe.co',
    contact_phone: null,
    linkedin_url: null,
    website: null,
    contact_verified: false,
    is_verified: false,
    work_experiences: [],
    educations: [{ id: 'e1', degree: 'MBA', institution: 'IIM', isVerified: false }],
    engagements: [],
    testimonials: [],
    awards: [
      { id: 'a1', title: 'Best Firm', isVerified: false },
      { id: 'a2', title: 'Other', isVerified: true },
    ],
    key_clients: [],
    ...rowOverrides,
  };
  const members = {
    findDetailByProfileId: vi.fn().mockResolvedValue(row),
    findAllForVerification: vi.fn().mockResolvedValue([row]),
    findProfilesByIds: vi.fn().mockResolvedValue(new Map([[MEMBER_ID, { first_name: 'Jane', last_name: 'Doe' }]])),
    applySectionEdit: vi.fn().mockResolvedValue(undefined),
    setContactVerified: vi.fn().mockResolvedValue(undefined),
    setProfileVerified: vi.fn().mockResolvedValue(undefined),
  };
  const service = new MemberVerificationService(members as unknown as MembersRepository);
  return { service, members };
}

describe('itemLabel', () => {
  it('names an item the way the admin list shows it', () => {
    expect(itemLabel('education', { degree: 'MBA', institution: 'IIM' })).toBe('MBA · IIM');
    expect(itemLabel('awards', { title: ' Best Firm ' })).toBe('Best Firm');
    expect(itemLabel('work_experiences', {})).toBe('Role');
  });
});

describe('adminSummary', () => {
  it('lists the pending entries and the contact block as what needs review', async () => {
    const { service } = setup();
    const [summary] = await service.adminSummary();
    expect(summary).toMatchObject({
      memberId: MEMBER_ID,
      name: 'Jane Doe',
      contactVerified: false,
      needsReview: 3, // the MBA, the award, and the contact block
      readyForBadge: false,
    });
    expect(summary.unverifiedItems.map((i) => i.label)).toEqual(['MBA · IIM', 'Best Firm']);
  });

  it('skips a member with nothing to decide and the badge already given', async () => {
    const { service } = setup({
      educations: [],
      awards: [{ id: 'a2', title: 'Other', isVerified: true }],
      work_email: null,
      is_verified: true,
    });
    expect(await service.adminSummary()).toEqual([]);
  });

  it('lists a fully checked member without the profile badge as ready for it', async () => {
    const { service } = setup({
      educations: [],
      awards: [{ id: 'a2', title: 'Other', isVerified: true }],
      work_email: null,
      is_verified: false,
    });
    expect(await service.adminSummary()).toMatchObject([
      { readyForBadge: true, needsReview: 0, profileVerified: false },
    ]);
  });

  it('counts contact only when there is contact data and it is unverified', async () => {
    const { service } = setup({ educations: [], awards: [], contact_phone: '+91 1' });
    expect((await service.adminSummary())[0]).toMatchObject({
      contactVerified: false,
      unverifiedItems: [],
      needsReview: 1,
    });
  });

  it('puts the member with the most to review first', async () => {
    const { service, members } = setup();
    const other = {
      profile_id: 'other',
      slug: 'sam',
      work_email: null,
      contact_phone: null,
      linkedin_url: null,
      website: null,
      contact_verified: false,
      is_verified: true,
      work_experiences: [],
      educations: [],
      engagements: [],
      testimonials: [],
      awards: [{ id: 'x', title: 'One', isVerified: false }],
      key_clients: [],
    };
    const first = (await members.findAllForVerification())[0];
    members.findAllForVerification.mockResolvedValue([other, first]);
    members.findProfilesByIds.mockResolvedValue(
      new Map([
        [MEMBER_ID, { first_name: 'Jane', last_name: 'Doe' }],
        ['other', { first_name: 'Sam', last_name: 'Lee' }],
      ])
    );
    expect((await service.adminSummary()).map((m) => m.name)).toEqual(['Jane Doe', 'Sam Lee']);
  });
});

describe('adminSetItemVerified', () => {
  it('verifies one item and stamps when it was verified', async () => {
    const { service, members } = setup();
    await service.adminSetItemVerified(MEMBER_ID, 'awards', 'a1', true);
    const saved = members.applySectionEdit.mock.calls[0][3] as {
      id: string;
      isVerified: boolean;
      verifiedAt?: string;
    }[];
    expect(saved.map((i) => [i.id, i.isVerified])).toEqual([
      ['a1', true],
      ['a2', true],
    ]);
    expect(saved[0].verifiedAt).toEqual(expect.any(String));
  });

  it('un-verifying clears the verified date', async () => {
    const { service, members } = setup({
      awards: [{ id: 'a1', title: 'Best Firm', isVerified: true, verifiedAt: '2026-11-01T00:00:00Z' }],
    });
    await service.adminSetItemVerified(MEMBER_ID, 'awards', 'a1', false);
    const saved = members.applySectionEdit.mock.calls[0][3] as { isVerified: boolean; verifiedAt?: string }[];
    expect(saved[0]).toMatchObject({ isVerified: false });
    expect(saved[0].verifiedAt).toBeUndefined();
  });

  it('404s on an unknown item and 400s on a section with no items', async () => {
    const { service } = setup();
    await expect(service.adminSetItemVerified(MEMBER_ID, 'awards', 'nope', true)).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.adminSetItemVerified(MEMBER_ID, 'contact', 'x', true)).rejects.toBeInstanceOf(
      BadRequestException
    );
  });
});

describe('contact and whole-profile verification', () => {
  it('sets the contact flag', async () => {
    const { service, members } = setup();
    await service.adminSetContactVerified(MEMBER_ID, true);
    expect(members.setContactVerified).toHaveBeenCalledWith(MEMBER_ID, true);
  });

  it('sets the whole-profile flag', async () => {
    const { service, members } = setup();
    await service.adminSetProfileVerified(MEMBER_ID, true);
    expect(members.setProfileVerified).toHaveBeenCalledWith(MEMBER_ID, true);
  });
});
