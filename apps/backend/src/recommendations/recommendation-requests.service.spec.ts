import { describe, expect, it, vi } from 'vitest';
import { ConflictException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { EmailService } from '../email/email.service';
import {
  MAX_OPEN_REQUESTS,
  RE_ASK_COOLDOWN_DAYS,
  RecommendationRequestsService,
} from './recommendation-requests.service';
import type {
  PersonRow,
  RecommendationRequestRow,
  RecommendationRequestsRepository,
} from './recommendation-requests.repository';

const ME = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const THEM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const me = { id: ME, role: 'member' } as unknown as AuthenticatedUser;
const them = { id: THEM, role: 'member' } as unknown as AuthenticatedUser;

const person = (id: string, name: string, email: string | null): PersonRow => ({
  profile_id: id,
  slug: name.toLowerCase(),
  photo_path: null,
  headline: null,
  first_name: name,
  last_name: 'X',
  avatar_url: null,
  work_email: email,
});

const row = (over: Partial<RecommendationRequestRow> = {}): RecommendationRequestRow => ({
  id: 'req1',
  requester_id: ME,
  recipient_id: THEM,
  message: null,
  status: 'pending',
  created_at: new Date().toISOString(),
  responded_at: null,
  ...over,
});

function setup() {
  const repo = {
    findPeople: vi.fn().mockResolvedValue(
      new Map([
        [ME, person(ME, 'Me', 'me@x.co')],
        [THEM, person(THEM, 'Them', 'them@x.co')],
      ])
    ),
    findPendingPair: vi.fn().mockResolvedValue(null),
    hasRecommendation: vi.fn().mockResolvedValue(false),
    findLatestEndedPair: vi.fn().mockResolvedValue(null),
    countOpenByRequester: vi.fn().mockResolvedValue(0),
    insert: vi.fn().mockResolvedValue(row()),
    findById: vi.fn().mockResolvedValue(row()),
    transitionPending: vi.fn(),
    listByRequester: vi.fn().mockResolvedValue([]),
    listPendingForRecipient: vi.fn().mockResolvedValue([]),
    fulfillPending: vi.fn().mockResolvedValue(undefined),
    buildPhotoUrl: vi.fn((p: string) => p),
  };
  const email = { enqueueAutomation: vi.fn().mockResolvedValue('queued') };
  const service = new RecommendationRequestsService(
    repo as unknown as RecommendationRequestsRepository,
    email as unknown as EmailService
  );
  return { service, repo, email };
}

const codeOf = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
    return 'OK';
  } catch (err) {
    return ((err as HttpException).getResponse() as { code: string }).code;
  }
};

describe('create', () => {
  it('creates the request and emails the recipient', async () => {
    const { service, repo, email } = setup();
    const dto = await service.create(THEM, me, { message: ' Could you? ' });
    expect(repo.insert).toHaveBeenCalledWith(ME, THEM, 'Could you?');
    expect(email.enqueueAutomation).toHaveBeenCalledWith(
      'recommendation_requested',
      { profileId: THEM, workEmail: 'them@x.co' },
      { idempotencyKey: 'recommendation_requested:req1', variables: { REQUESTER_NAME: 'Me X' } }
    );
    expect(dto).toMatchObject({ status: 'pending', requester: { id: ME }, recipient: { id: THEM } });
  });

  it('still succeeds when the email cannot be queued', async () => {
    const { service, email } = setup();
    email.enqueueAutomation.mockRejectedValue(new Error('boom'));
    await expect(service.create(THEM, me, {})).resolves.toBeTruthy();
  });

  it('refuses yourself', async () => {
    const { service } = setup();
    expect(await codeOf(() => service.create(ME, me, {}))).toBe('RECOMMENDATION_REQUEST_SELF');
  });

  it('404s for an inactive recipient and 403s for an inactive requester', async () => {
    const { service, repo } = setup();
    repo.findPeople.mockResolvedValue(new Map([[ME, person(ME, 'Me', null)]]));
    await expect(service.create(THEM, me, {})).rejects.toBeInstanceOf(NotFoundException);
    repo.findPeople.mockResolvedValue(new Map([[THEM, person(THEM, 'Them', null)]]));
    await expect(service.create(THEM, me, {})).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('409s when a request is already pending, or the recipient already recommended you', async () => {
    const { service, repo } = setup();
    repo.findPendingPair.mockResolvedValue(row());
    expect(await codeOf(() => service.create(THEM, me, {}))).toBe('RECOMMENDATION_REQUEST_PENDING');
    repo.findPendingPair.mockResolvedValue(null);
    repo.hasRecommendation.mockResolvedValue(true);
    expect(await codeOf(() => service.create(THEM, me, {}))).toBe('RECOMMENDATION_ALREADY_GIVEN');
  });

  it('429s inside the cooldown after an ignored request, and allows it after', async () => {
    const { service, repo } = setup();
    const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
    repo.findLatestEndedPair.mockResolvedValue(
      row({ status: 'ignored', created_at: daysAgo(RE_ASK_COOLDOWN_DAYS - 1) })
    );
    expect(await codeOf(() => service.create(THEM, me, {}))).toBe('RECOMMENDATION_REQUEST_COOLDOWN');
    repo.findLatestEndedPair.mockResolvedValue(
      row({ status: 'ignored', created_at: daysAgo(RE_ASK_COOLDOWN_DAYS + 1) })
    );
    expect(await codeOf(() => service.create(THEM, me, {}))).toBe('OK');
  });

  it('429s at the open-request limit', async () => {
    const { service, repo } = setup();
    repo.countOpenByRequester.mockResolvedValue(MAX_OPEN_REQUESTS);
    expect(await codeOf(() => service.create(THEM, me, {}))).toBe('RECOMMENDATION_REQUEST_LIMIT');
  });
});

describe('list', () => {
  it('shows the requester an ignored request as pending, never as ignored', async () => {
    const { service, repo } = setup();
    repo.listByRequester.mockResolvedValue([row({ status: 'ignored', responded_at: '2026-11-16T00:00:00Z' })]);
    const [dto] = await service.list(me, 'sent');
    expect(dto.status).toBe('pending');
    expect(dto.respondedAt).toBeNull();
  });

  it('lists pending asks for the recipient', async () => {
    const { service, repo } = setup();
    repo.listPendingForRecipient.mockResolvedValue([row()]);
    expect(await service.list(them, 'received')).toHaveLength(1);
    expect(repo.listPendingForRecipient).toHaveBeenCalledWith(THEM);
  });
});

describe('update', () => {
  it('the recipient can ignore; the requester can cancel', async () => {
    const { service, repo } = setup();
    repo.transitionPending.mockResolvedValue(row({ status: 'ignored' }));
    await service.update('req1', them, { action: 'ignore' });
    expect(repo.transitionPending).toHaveBeenCalledWith('req1', 'ignored');
    repo.transitionPending.mockResolvedValue(row({ status: 'cancelled' }));
    await service.update('req1', me, { action: 'cancel' });
    expect(repo.transitionPending).toHaveBeenCalledWith('req1', 'cancelled');
  });

  it('refuses the wrong side, strangers, and a request that is no longer pending', async () => {
    const { service, repo } = setup();
    expect(await codeOf(() => service.update('req1', me, { action: 'ignore' }))).toBe(
      'RECOMMENDATION_REQUEST_FORBIDDEN'
    );
    expect(await codeOf(() => service.update('req1', them, { action: 'cancel' }))).toBe(
      'RECOMMENDATION_REQUEST_FORBIDDEN'
    );
    const stranger = { id: 'zzz', role: 'member' } as unknown as AuthenticatedUser;
    expect(await codeOf(() => service.update('req1', stranger, { action: 'ignore' }))).toBe(
      'RECOMMENDATION_REQUEST_NOT_FOUND'
    );
    repo.transitionPending.mockResolvedValue(null);
    await expect(service.update('req1', them, { action: 'ignore' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('fulfill', () => {
  it('closes the open request of the member who got the recommendation', async () => {
    const { service, repo } = setup();
    await service.fulfill(ME, THEM);
    expect(repo.fulfillPending).toHaveBeenCalledWith(ME, THEM);
  });
});
