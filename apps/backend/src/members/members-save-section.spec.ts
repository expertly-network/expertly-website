import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { AdminAccessService } from '../auth/admin-access.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { MemberProfileDetailRow, MembersRepository } from './members.repository';
import { MembersService } from './members.service';

const MEMBER_ID = '22222222-2222-4222-8222-222222222222';

const owner: AuthenticatedUser = {
  id: MEMBER_ID,
  email: 'jane@example.com',
  role: 'member',
  status: 'active',
  memberStatus: 'active',
  firstName: 'Jane',
  lastName: 'Doe',
};

const award = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  title: 'Best Tax Firm',
  issuingBody: 'ET',
  year: 2023,
  description: 'Won it',
  isVerified: true,
  ...over,
});

function row(over: Partial<MemberProfileDetailRow> = {}): MemberProfileDetailRow {
  return {
    profile_id: MEMBER_ID,
    slug: 'jane-doe',
    headline: 'CA',
    bio: 'Bio',
    firm_name: null,
    region: null,
    country: 'IN',
    state: null,
    city: null,
    years_of_experience: 10,
    rate_min_cents: null,
    rate_max_cents: null,
    rate_currency: 'INR',
    member_tier: 'standard',
    is_available: true,
    availability_notes: null,
    contact_email: null,
    work_email: 'work@doe.co',
    contact_phone: '+91 1',
    linkedin_url: null,
    website: null,
    is_verified: true,
    contact_verified: true,
    photo_path: null,
    status: 'active',
    application_id: null,
    membership_started_at: '2026-01-01T00:00:00Z',
    renewal_payment_status: null,
    work_experiences: [],
    educations: [],
    engagements: [],
    qualifications: [],
    credentials: [],
    testimonials: [],
    awards: [award()],
    key_clients: [],
    ...over,
  } as unknown as MemberProfileDetailRow;
}

function setup(live = row()) {
  const repo = {
    findDetailByProfileId: vi.fn().mockResolvedValue(live),
    findProfilesByIds: vi.fn().mockResolvedValue(new Map()),
    findMemberServicesByMemberIds: vi.fn().mockResolvedValue(new Map()),
    buildPhotoUrl: vi.fn((p: string) => p),
    applySectionEdit: vi.fn().mockResolvedValue(undefined),
    applyContactLive: vi.fn().mockResolvedValue(undefined),
    applyHeadlineBioEdit: vi.fn().mockResolvedValue(undefined),
  };
  const service = new MembersService(
    repo as unknown as MembersRepository,
    { hasFreshPermission: vi.fn().mockResolvedValue(false) } as unknown as AdminAccessService
  );
  return { service, repo };
}

const savedItems = (repo: ReturnType<typeof setup>['repo']) =>
  repo.applySectionEdit.mock.calls[0][3] as Record<string, unknown>[];

describe('MembersService.saveSection', () => {
  it('only the owner can save', async () => {
    const { service } = setup();
    await expect(
      service.saveSection(MEMBER_ID, { ...owner, id: 'someone-else' }, 'awards', [award()])
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('writes nothing for an unchanged section', async () => {
    const { service, repo } = setup();
    const result = await service.saveSection(MEMBER_ID, owner, 'awards', [award()]);
    expect(result.changed).toBe(false);
    expect(repo.applySectionEdit).not.toHaveBeenCalled();
  });

  it('goes live at once, and a new item is saved unverified with a fresh id', async () => {
    const { service, repo } = setup();
    const result = await service.saveSection(MEMBER_ID, owner, 'awards', [award(), { title: 'Top 40 under 40' }]);
    expect(result.changed).toBe(true);
    const items = savedItems(repo);
    expect(items[0]).toMatchObject({ id: 'a1', isVerified: true });
    expect(items[1]).toMatchObject({ title: 'Top 40 under 40', isVerified: false });
    expect(typeof items[1].id).toBe('string');
  });

  it('keeps the tick on a typo fix in the description', async () => {
    const { service, repo } = setup();
    await service.saveSection(MEMBER_ID, owner, 'awards', [award({ description: 'Won it!' })]);
    expect(savedItems(repo)[0]).toMatchObject({ description: 'Won it!', isVerified: true });
  });

  it('resets the tick when the title changes', async () => {
    const { service, repo } = setup();
    await service.saveSection(MEMBER_ID, owner, 'awards', [award({ title: 'Another award' })]);
    expect(savedItems(repo)[0]).toMatchObject({ title: 'Another award', isVerified: false });
  });

  it('never trusts isVerified from the payload', async () => {
    const { service, repo } = setup(row({ awards: [] }));
    await service.saveSection(MEMBER_ID, owner, 'awards', [{ title: 'New', isVerified: true }]);
    expect(savedItems(repo)[0].isVerified).toBe(false);
  });

  it('removes items the member left out', async () => {
    const { service, repo } = setup();
    await service.saveSection(MEMBER_ID, owner, 'awards', []);
    expect(savedItems(repo)).toEqual([]);
  });

  it('contact: a change resets contact verification; an identical save writes nothing', async () => {
    const { service, repo } = setup();
    const same = { workEmail: 'work@doe.co', contactPhone: '+91 1', linkedinUrl: null, website: null };
    expect((await service.saveSection(MEMBER_ID, owner, 'contact', same)).changed).toBe(false);
    expect(repo.applyContactLive).not.toHaveBeenCalled();

    await service.saveSection(MEMBER_ID, owner, 'contact', { ...same, contactPhone: '+91 2' });
    expect(repo.applyContactLive).toHaveBeenCalledWith(
      MEMBER_ID,
      { workEmail: 'work@doe.co', contactPhone: '+91 2', linkedinUrl: null, website: null },
      false
    );
  });

  it('headline_bio carries no verification and skips an unchanged save', async () => {
    const { service, repo } = setup();
    expect((await service.saveSection(MEMBER_ID, owner, 'headline_bio', { headline: 'CA', bio: 'Bio' })).changed).toBe(
      false
    );
    await service.saveSection(MEMBER_ID, owner, 'headline_bio', { headline: 'CA, CPA', bio: 'Bio' });
    expect(repo.applyHeadlineBioEdit).toHaveBeenCalledWith(MEMBER_ID, 'CA, CPA', 'Bio');
  });

  it('returns the owner view of the profile', async () => {
    const { service } = setup();
    const { member } = await service.saveSection(MEMBER_ID, owner, 'awards', [award()]);
    expect(member.contactVerified).toBe(true);
  });
});
