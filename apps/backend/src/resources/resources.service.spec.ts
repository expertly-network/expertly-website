import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { ProfileRoleRow, ProfilesRepository } from '../auth/profiles.repository';
import type { Role } from '../auth/types/auth.types';
import type {
  CollectionRow,
  LearningRow,
  PerkRow,
  ResourcesRepository,
  TemplatePublicRow,
} from './resources.repository';
import { ResourcesService } from './resources.service';

const TODAY = '2026-10-30';

function perkRow(overrides: Partial<PerkRow> = {}): PerkRow {
  return {
    id: 'perk-1',
    slug: 'acme',
    name: 'Acme',
    category: 'software',
    tagline: 't',
    description: 'd',
    products: [],
    website_url: 'https://acme.com',
    logo_url: 'logos/acme.png',
    cover_image_url: 'https://cdn.example/cover.png',
    offer_status: 'live',
    user_offer: '10% off',
    user_coupon_code: 'CLIENT10',
    user_offer_url: null,
    member_offer: '30% off',
    member_coupon_code: 'MEMBER30',
    member_offer_url: 'https://acme.com/members',
    offer_terms: 'Terms',
    offer_expires_at: null,
    is_featured: false,
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  } as PerkRow;
}

function learningRow(id: string, access: string, overrides: Partial<LearningRow> = {}): LearningRow {
  return {
    id,
    title: `Video ${id}`,
    summary: 's',
    video_provider: 'youtube',
    video_url: `https://youtube.com/watch?v=${id}`,
    thumbnail_url: null,
    channel: 'c',
    duration_minutes: 10,
    category: 'tax',
    level: 'beginner',
    audiences: [],
    access,
    is_featured: false,
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  } as LearningRow;
}

function playlist(itemIds: string[], overrides: Partial<CollectionRow> = {}): CollectionRow {
  return {
    id: 'pl-1',
    kind: 'learning_playlist',
    slug: 'pl',
    title: 'Playlist',
    description: null,
    audiences: [],
    item_ids: itemIds,
    cover_image_url: null,
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  } as CollectionRow;
}

function templateRow(): TemplatePublicRow {
  return {
    id: 'tpl-1',
    slug: 'nda',
    title: 'NDA',
    description: 'd',
    category: 'legal',
    highlights: [],
    file_name: 'nda.docx',
    file_size_bytes: 1000,
    file_type: 'docx',
    preview_image_url: null,
    audiences: [],
    is_featured: false,
    sort_order: 0,
    is_active: true,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  } as unknown as TemplatePublicRow;
}

type RepoMock = { [K in keyof ResourcesRepository]: Mock };

function setup(profile: ProfileRoleRow | null = null, memberStatus: 'active' | 'deactivated' | null = null) {
  const repo = {
    listPerks: vi.fn().mockResolvedValue([]),
    findActivePerkBySlug: vi.fn(),
    listLearnings: vi.fn().mockResolvedValue([]),
    listCollections: vi.fn().mockResolvedValue([]),
    findActiveLearningById: vi.fn(),
    listActivePlaylistItemIds: vi.fn().mockResolvedValue([]),
    listTemplates: vi.fn().mockResolvedValue([]),
    findMemberStatus: vi.fn().mockResolvedValue(memberStatus),
    findActiveTemplateFile: vi.fn().mockResolvedValue({ file_path: 'starter/nda.docx', file_name: 'nda.docx' }),
    signTemplateFile: vi.fn().mockResolvedValue('https://signed.example/nda'),
  } as unknown as RepoMock;
  const profiles = { findById: vi.fn().mockResolvedValue(profile) };
  const service = new ResourcesService(
    repo as unknown as ResourcesRepository,
    profiles as unknown as ProfilesRepository
  );
  return { service, repo, profiles };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('ResourcesService perks — role shaping', () => {
  async function perkAs(role: Role | undefined, row = perkRow()) {
    const { service, repo } = setup();
    repo.findActivePerkBySlug.mockResolvedValue(row);
    return service.getPerk('acme', role);
  }

  it('shows a guest the offer metadata but no code or URL', async () => {
    expect(await perkAs(undefined)).toMatchObject({
      offer: null,
      couponCode: null,
      offerUrl: null,
      offerTerms: null,
      canRedeem: false,
      lockReason: 'sign_in',
    });
  });

  it('gives a client the client tier only', async () => {
    expect(await perkAs('client')).toMatchObject({
      offer: '10% off',
      couponCode: 'CLIENT10',
      offerUrl: null,
      canRedeem: true,
      lockReason: null,
    });
  });

  it.each<Role>(['member', 'admin'])('gives a %s the member tier', async (role) => {
    expect(await perkAs(role)).toMatchObject({
      offer: '30% off',
      couponCode: 'MEMBER30',
      offerUrl: 'https://acme.com/members',
      canRedeem: true,
    });
  });

  it('falls back to the client tier for a member when there is no member offer', async () => {
    const row = perkRow({ member_offer: null, member_coupon_code: null, member_offer_url: null });
    expect(await perkAs('member', row)).toMatchObject({ offer: '10% off', couponCode: 'CLIENT10' });
  });

  it('never leaks the member code to a client, even without a client offer', async () => {
    const row = perkRow({ user_offer: null, user_coupon_code: null });
    const dto = await perkAs('client', row);
    expect(dto).toMatchObject({
      offer: null,
      couponCode: null,
      offerUrl: null,
      canRedeem: false,
      lockReason: 'unavailable',
    });
    expect(JSON.stringify(dto)).not.toContain('MEMBER30');
  });

  it.each<Role | undefined>([undefined, 'client', 'member', 'admin'])('locks an expired offer for %s', async (role) => {
    const dto = await perkAs(role, perkRow({ offer_expires_at: '2026-10-29' }));
    expect(dto).toMatchObject({ couponCode: null, offerUrl: null, canRedeem: false, lockReason: 'expired' });
  });

  it('keeps an offer expiring today redeemable', async () => {
    expect(await perkAs('member', perkRow({ offer_expires_at: TODAY }))).toMatchObject({
      canRedeem: true,
      offerExpiresAt: TODAY,
    });
  });

  it.each<Role | undefined>([undefined, 'client', 'member', 'admin'])(
    'locks a coming_soon perk for %s',
    async (role) => {
      const dto = await perkAs(role, perkRow({ offer_status: 'coming_soon' }));
      expect(dto).toMatchObject({ couponCode: null, offerUrl: null, canRedeem: false, lockReason: 'coming_soon' });
    }
  );

  it('resolves storage paths to public URLs and leaves https URLs alone', async () => {
    expect(await perkAs(undefined)).toMatchObject({
      logoUrl: 'https://project.supabase.test/storage/v1/object/public/resource-assets/logos/acme.png',
      coverImageUrl: 'https://cdn.example/cover.png',
    });
  });

  it('lists only active perks', async () => {
    const { service, repo } = setup();
    repo.listPerks.mockResolvedValue([perkRow(), perkRow({ id: 'perk-2', is_active: false })]);
    expect((await service.listPerks('member')).map((p) => p.id)).toEqual(['perk-1']);
  });

  it('404s an unknown perk', async () => {
    const { service, repo } = setup();
    repo.findActivePerkBySlug.mockResolvedValue(null);
    await expect(service.getPerk('x')).rejects.toMatchObject({ response: { code: 'PERK_NOT_FOUND' } });
  });
});

describe('ResourcesService learnings — video access', () => {
  const rows = [
    learningRow('v1', 'auto'),
    learningRow('v2', 'auto'),
    learningRow('open', 'open'),
    learningRow('mem', 'members'),
  ];

  async function listAs(role: Role | undefined, collections: CollectionRow[] = [playlist(['v1', 'v2'])]) {
    const { service, repo } = setup();
    repo.listLearnings.mockResolvedValue(rows);
    repo.listCollections.mockResolvedValue(collections);
    const list = await service.listLearnings(role);
    return Object.fromEntries(
      list.map((l) => [l.id, { canWatch: l.canWatch, videoUrl: !!l.videoUrl, lockReason: l.lockReason }])
    );
  }

  it('lets a client watch only the first video of each playlist and open videos', async () => {
    expect(await listAs('client')).toEqual({
      v1: { canWatch: true, videoUrl: true, lockReason: null },
      v2: { canWatch: false, videoUrl: false, lockReason: 'membership' },
      open: { canWatch: true, videoUrl: true, lockReason: null },
      mem: { canWatch: false, videoUrl: false, lockReason: 'membership' },
    });
  });

  it('never gives a guest a video URL, not even the free one', async () => {
    const result = await listAs(undefined);
    for (const id of ['v1', 'v2', 'open', 'mem']) {
      expect(result[id]).toEqual({ canWatch: false, videoUrl: false, lockReason: 'sign_in' });
    }
  });

  it.each<Role>(['member', 'admin'])('lets a %s watch everything', async (role) => {
    const result = await listAs(role);
    expect(Object.values(result).every((r) => r.canWatch && r.videoUrl)).toBe(true);
  });

  it('ignores inactive playlists and other collection kinds when picking free videos', async () => {
    const result = await listAs('client', [
      playlist(['v1'], { is_active: false }),
      playlist(['v2'], { id: 'kit', kind: 'perk_stack' }),
    ]);
    expect(result.v1.canWatch).toBe(false);
    expect(result.v2.canWatch).toBe(false);
  });

  it('applies the same first-free rule on the single-video route', async () => {
    const { service, repo } = setup();
    repo.listActivePlaylistItemIds.mockResolvedValue([playlist(['v1', 'v2'])]);
    repo.findActiveLearningById.mockResolvedValueOnce(learningRow('v1', 'auto'));
    expect(await service.getLearning('v1', 'client')).toMatchObject({ canWatch: true });
    repo.findActiveLearningById.mockResolvedValueOnce(learningRow('v2', 'auto'));
    expect(await service.getLearning('v2', 'client')).toMatchObject({ canWatch: false, videoUrl: null });
  });

  it('skips the playlist read for non-auto videos', async () => {
    const { service, repo } = setup();
    repo.findActiveLearningById.mockResolvedValue(learningRow('mem', 'members'));
    expect(await service.getLearning('mem', 'member')).toMatchObject({ canWatch: true });
    expect(repo.listActivePlaylistItemIds).not.toHaveBeenCalled();
  });
});

describe('ResourcesService templates', () => {
  it.each<[Role | undefined, boolean, string | null]>([
    [undefined, false, 'sign_in'],
    ['client', false, 'membership'],
    ['member', true, null],
    ['admin', true, null],
  ])('%s: canDownload=%s lockReason=%s, and never a file path', async (role, canDownload, lockReason) => {
    const { service, repo } = setup();
    repo.listTemplates.mockResolvedValue([templateRow()]);
    const [dto] = await service.listTemplates(role);
    expect(dto).toMatchObject({ canDownload, lockReason });
    expect(dto).not.toHaveProperty('filePath');
  });

  describe('downloadTemplate (fresh role + member status)', () => {
    it.each<[string, ProfileRoleRow | null, 'active' | 'deactivated' | null, string]>([
      ['an active member', { role: 'member', status: 'active', admin_role: null }, 'active', 'OK'],
      ['an admin', { role: 'admin', status: 'active', admin_role: null }, null, 'OK'],
      [
        'a deactivated member',
        { role: 'member', status: 'active', admin_role: null },
        'deactivated',
        'TEMPLATE_MEMBERS_ONLY',
      ],
      ['a client', { role: 'client', status: 'active', admin_role: null }, null, 'TEMPLATE_MEMBERS_ONLY'],
      [
        'a suspended member',
        { role: 'member', status: 'suspended', admin_role: null },
        'active',
        'TEMPLATE_MEMBERS_ONLY',
      ],
      ['a missing profile', null, null, 'TEMPLATE_MEMBERS_ONLY'],
    ])('%s → %s', async (_label, profile, memberStatus, expected) => {
      const { service, repo } = setup(profile, memberStatus);
      const result = await service.downloadTemplate('tpl-1', 'user-1').then(
        () => 'OK',
        (err: { response: { code: string } }) => err.response.code
      );
      expect(result).toBe(expected);
      if (expected === 'OK') expect(repo.signTemplateFile).toHaveBeenCalledWith('starter/nda.docx', 'nda.docx', 60);
      else expect(repo.signTemplateFile).not.toHaveBeenCalled();
    });
  });
});
