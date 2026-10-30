import { describe, expect, it, vi, type Mock } from 'vitest';
import type { AdminAccessService } from '../auth/admin-access.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  MemberProfileDetailRow,
  MemberProfileEditRow,
  MembersRepository,
  ProfileIdentityRow,
} from './members.repository';
import { MembersService } from './members.service';

const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_MEMBER_ID = '33333333-3333-4333-8333-333333333333';
const VIEWER_ID = '44444444-4444-4444-8444-444444444444';

function detailRow(overrides: Partial<MemberProfileDetailRow> = {}): MemberProfileDetailRow {
  return {
    profile_id: MEMBER_ID,
    slug: 'jane-doe',
    headline: 'CA',
    bio: 'Bio',
    firm_name: 'Doe & Co',
    firm_website: null,
    region: null,
    country: 'IN',
    state: null,
    city: 'Mumbai',
    years_of_experience: 10,
    rate_min_cents: null,
    rate_max_cents: null,
    rate_currency: 'INR',
    member_tier: 'standard',
    is_available: true,
    availability_notes: null,
    contact_email: 'jane@doe.co',
    work_email: 'work@doe.co',
    contact_phone: '+91 98765 43210',
    linkedin_url: 'https://linkedin.com/in/jane',
    website: 'https://doe.co',
    is_verified: true,
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
    awards: [],
    key_clients: [],
    ...overrides,
  } as MemberProfileDetailRow;
}

function identity(overrides: Partial<ProfileIdentityRow> = {}): ProfileIdentityRow {
  return {
    id: MEMBER_ID,
    first_name: 'Jane',
    last_name: 'Doe',
    email: 'jane@login.example',
    avatar_url: null,
    initials: null,
    status: 'active',
    deleted_at: null,
    ...overrides,
  };
}

function viewer(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: VIEWER_ID,
    email: 'viewer@example.com',
    role: 'client',
    status: 'active',
    memberStatus: null,
    firstName: 'V',
    lastName: 'W',
    ...overrides,
  };
}

type RepoMock = { [K in keyof MembersRepository]: Mock };

function setup({
  row = detailRow(),
  account = identity(),
  hasConsultation = false,
  managesMembers = false,
}: {
  row?: MemberProfileDetailRow | null;
  account?: ProfileIdentityRow;
  hasConsultation?: boolean;
  managesMembers?: boolean;
} = {}) {
  const repo = {
    findDetailBySlug: vi.fn().mockResolvedValue(row),
    findDetailByProfileId: vi.fn().mockResolvedValue(row),
    findProfilesByIds: vi.fn().mockResolvedValue(new Map([[MEMBER_ID, account]])),
    findMemberServicesByMemberIds: vi.fn().mockResolvedValue(new Map()),
    findSlugAndPhotoByProfileIds: vi.fn().mockResolvedValue(new Map()),
    hasConsultationWith: vi.fn().mockResolvedValue(hasConsultation),
    buildPhotoUrl: vi.fn((path: string) => `https://cdn.test/${path}`),
    findEditById: vi.fn(),
    claimEditDecision: vi.fn(),
    revertEditDecision: vi.fn(),
    applySectionEdit: vi.fn(),
    findProofFileSize: vi.fn(),
    downloadProofFile: vi.fn(),
    uploadPublicAsset: vi.fn(),
  } as unknown as RepoMock;
  const adminAccess = { hasFreshPermission: vi.fn().mockResolvedValue(managesMembers) };
  const service = new MembersService(
    repo as unknown as MembersRepository,
    adminAccess as unknown as AdminAccessService
  );
  return { service, repo, adminAccess };
}

describe('MembersService.findOneBySlug — contact visibility', () => {
  const CONTACT_HIDDEN = {
    contactEmail: null,
    workEmail: null,
    contactPhone: null,
    linkedinUrl: null,
    contactVisible: false,
  };
  const CONTACT_SHOWN = {
    contactEmail: 'jane@doe.co',
    workEmail: 'work@doe.co',
    contactPhone: '+91 98765 43210',
    linkedinUrl: 'https://linkedin.com/in/jane',
    contactVisible: true,
  };

  it('shows contact details to the owner', async () => {
    const { service, adminAccess } = setup();
    const dto = await service.findOneBySlug(
      'jane-doe',
      viewer({ id: MEMBER_ID, role: 'member', memberStatus: 'active' })
    );
    expect(dto).toMatchObject(CONTACT_SHOWN);
    expect(adminAccess.hasFreshPermission).not.toHaveBeenCalled();
  });

  it('shows them to an admin with manageMembers (fresh check)', async () => {
    const { service, adminAccess } = setup({ managesMembers: true });
    const admin = viewer({ role: 'admin' });
    expect(await service.findOneBySlug('jane-doe', admin)).toMatchObject(CONTACT_SHOWN);
    expect(adminAccess.hasFreshPermission).toHaveBeenCalledWith(admin, 'manageMembers');
  });

  it('hides them from an admin without manageMembers', async () => {
    const { service } = setup({ managesMembers: false });
    expect(await service.findOneBySlug('jane-doe', viewer({ role: 'admin' }))).toMatchObject(CONTACT_HIDDEN);
  });

  it('shows them to an active member', async () => {
    const { service } = setup();
    expect(await service.findOneBySlug('jane-doe', viewer({ role: 'member', memberStatus: 'active' }))).toMatchObject(
      CONTACT_SHOWN
    );
  });

  it('hides them from a deactivated member', async () => {
    const { service, repo } = setup({ hasConsultation: true });
    expect(
      await service.findOneBySlug('jane-doe', viewer({ role: 'member', memberStatus: 'deactivated' }))
    ).toMatchObject(CONTACT_HIDDEN);
    expect(repo.hasConsultationWith).not.toHaveBeenCalled();
  });

  it('shows them to a client who has sent this member a consultation request', async () => {
    const { service, repo } = setup({ hasConsultation: true });
    expect(await service.findOneBySlug('jane-doe', viewer())).toMatchObject(CONTACT_SHOWN);
    expect(repo.hasConsultationWith).toHaveBeenCalledWith(VIEWER_ID, MEMBER_ID);
  });

  it('hides them from a client without a consultation', async () => {
    const { service } = setup({ hasConsultation: false });
    expect(await service.findOneBySlug('jane-doe', viewer())).toMatchObject(CONTACT_HIDDEN);
  });

  // Guests never reach the service: GET /v1/members/:slug requires a session (see
  // test/route-access.spec.ts), so an anonymous caller gets 401 before any contact logic runs.

  it('strips private proof and client emails for non-privileged viewers', async () => {
    const row = detailRow({
      engagements: [
        {
          id: 'e1',
          clientName: 'Acme',
          clientEmail: 'cfo@acme.com',
          proofAttachments: [{ type: 'file', url: 'p', label: 'l' }],
        },
      ] as unknown as MemberProfileDetailRow['engagements'],
    });
    const { service } = setup({ row });
    const dto = await service.findOneBySlug('jane-doe', viewer({ role: 'member', memberStatus: 'active' }));
    expect(dto.engagements[0]).not.toHaveProperty('clientEmail');
    expect(dto.engagements[0]).not.toHaveProperty('proofAttachments');
  });

  describe('unlisted profiles', () => {
    it.each<[string, Partial<MemberProfileDetailRow>, Partial<ProfileIdentityRow>]>([
      ['a deactivated listing', { status: 'deactivated' } as Partial<MemberProfileDetailRow>, {}],
      ['a suspended account', {}, { status: 'suspended' }],
      ['a soft-deleted account', {}, { deleted_at: '2026-10-01T00:00:00Z' }],
    ])('404s %s for other viewers', async (_label, rowPatch, accountPatch) => {
      const { service } = setup({ row: detailRow(rowPatch), account: identity(accountPatch) });
      await expect(
        service.findOneBySlug('jane-doe', viewer({ role: 'member', memberStatus: 'active' }))
      ).rejects.toMatchObject({ response: { code: 'MEMBER_NOT_FOUND' } });
    });

    it('still serves it to the owner and to a member-managing admin', async () => {
      const unlisted = { row: detailRow({ status: 'deactivated' } as Partial<MemberProfileDetailRow>) };
      await expect(
        setup(unlisted).service.findOneBySlug(
          'jane-doe',
          viewer({ id: MEMBER_ID, role: 'member', memberStatus: 'deactivated' })
        )
      ).resolves.toMatchObject({ slug: 'jane-doe' });
      await expect(
        setup({ ...unlisted, managesMembers: true }).service.findOneBySlug('jane-doe', viewer({ role: 'admin' }))
      ).resolves.toMatchObject({ slug: 'jane-doe' });
    });
  });

  it('404s an unknown slug', async () => {
    const { service } = setup({ row: null });
    await expect(service.findOneBySlug('nope', viewer())).rejects.toMatchObject({
      response: { code: 'MEMBER_NOT_FOUND' },
    });
  });
});

describe('MembersService.adminReviewEdit — key-client logos', () => {
  const admin = viewer({ id: 'admin-1', role: 'admin' });

  function keyClientEdit(item: Record<string, unknown>): MemberProfileEditRow {
    return {
      id: 'edit-1',
      member_id: MEMBER_ID,
      section: 'key_clients',
      payload: [item],
      proof_file_url: null,
      proof_link: null,
      status: 'pending',
      review_note: null,
      item_reviews: null,
      reviewed_by: null,
      reviewed_at: null,
      submitted_at: '2026-10-29T00:00:00Z',
    };
  }

  function setupReview(edit: MemberProfileEditRow, live: Record<string, unknown>[] = []) {
    const ctx = setup({ row: detailRow({ key_clients: live as unknown as MemberProfileDetailRow['key_clients'] }) });
    ctx.repo.findEditById.mockResolvedValue(edit);
    ctx.repo.claimEditDecision.mockResolvedValue({ ...edit, status: 'verified' });
    return ctx;
  }

  function appliedItems(repo: RepoMock): Record<string, unknown>[] {
    expect(repo.applySectionEdit).toHaveBeenCalledTimes(1);
    return repo.applySectionEdit.mock.calls[0][3] as Record<string, unknown>[];
  }

  it('ignores a client-supplied logoUrl on a new item', async () => {
    const { service, repo } = setupReview(keyClientEdit({ name: 'Acme', logoUrl: 'https://evil.example/tracker.png' }));
    await service.adminReviewEdit('edit-1', admin, { status: 'verified' });
    const [item] = appliedItems(repo);
    expect(item).toMatchObject({ name: 'Acme', logoUrl: null, isVerified: false });
    expect(repo.uploadPublicAsset).not.toHaveBeenCalled();
  });

  it('keeps the live logoUrl of an edited item rather than the payload one', async () => {
    const { service, repo } = setupReview(
      keyClientEdit({ id: 'k1', name: 'Acme Ltd', logoUrl: 'https://evil.example/x.png' }),
      [{ id: 'k1', name: 'Acme', logoUrl: 'https://cdn.test/members/m/client-logos/old.png' }]
    );
    await service.adminReviewEdit('edit-1', admin, { status: 'verified' });
    expect(appliedItems(repo)[0]).toMatchObject({
      id: 'k1',
      name: 'Acme Ltd',
      logoUrl: 'https://cdn.test/members/m/client-logos/old.png',
    });
  });

  it("refuses a logoUploadPath that isn't the member's own upload and reverts the decision", async () => {
    const { service, repo } = setupReview(
      keyClientEdit({ name: 'Acme', logoUploadPath: `${OTHER_MEMBER_ID}/1698765432101-logo.png` })
    );
    await expect(service.adminReviewEdit('edit-1', admin, { status: 'verified' })).rejects.toMatchObject({
      response: { code: 'UPLOAD_NOT_OWNED' },
    });
    expect(repo.downloadProofFile).not.toHaveBeenCalled();
    expect(repo.revertEditDecision).toHaveBeenCalledWith('edit-1');
  });

  it.each([
    `${MEMBER_ID}/../${OTHER_MEMBER_ID}/1-logo.png`,
    `${MEMBER_ID}/1-%2e%2e-logo.png`,
    `${MEMBER_ID}/x/1-logo.png`,
  ])('refuses a traversal-shaped path %j', async (logoUploadPath) => {
    const { service } = setupReview(keyClientEdit({ name: 'Acme', logoUploadPath }));
    await expect(service.adminReviewEdit('edit-1', admin, { status: 'verified' })).rejects.toMatchObject({
      response: { code: 'UPLOAD_NOT_OWNED' },
    });
  });

  it('publishes an owned PNG upload and points logoUrl at the public copy', async () => {
    const png = Buffer.from(
      '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d69c4f0000000049454e44ae426082',
      'hex'
    );
    const { service, repo } = setupReview(
      keyClientEdit({
        name: 'Acme',
        logoUrl: 'https://evil.example/x.png',
        logoUploadPath: `${MEMBER_ID}/1698765432101-logo.png`,
      })
    );
    repo.findProofFileSize.mockResolvedValue(png.length);
    repo.downloadProofFile.mockResolvedValue(png);
    await service.adminReviewEdit('edit-1', admin, { status: 'verified' });
    const [publicPath, , mime] = repo.uploadPublicAsset.mock.calls[0] as [string, Buffer, string];
    expect(publicPath).toMatch(new RegExp(`^members/${MEMBER_ID}/client-logos/[0-9a-f-]{36}\\.png$`));
    expect(mime).toBe('image/png');
    const [item] = appliedItems(repo);
    expect(item.logoUrl).toBe(`https://cdn.test/${publicPath}`);
    expect(item).not.toHaveProperty('logoUploadPath');
  });

  it('rejects an owned upload that is not an image', async () => {
    const { service, repo } = setupReview(
      keyClientEdit({ name: 'Acme', logoUploadPath: `${MEMBER_ID}/1698765432101-logo.png` })
    );
    repo.findProofFileSize.mockResolvedValue(20);
    repo.downloadProofFile.mockResolvedValue(Buffer.from('<svg onload="alert(1)"/>'));
    await expect(service.adminReviewEdit('edit-1', admin, { status: 'verified' })).rejects.toMatchObject({
      response: { code: 'LOGO_INVALID_TYPE' },
    });
    expect(repo.uploadPublicAsset).not.toHaveBeenCalled();
  });
});
