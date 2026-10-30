import { describe, expect, it, vi, type Mock } from 'vitest';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ConsultationsRepository } from './consultations.repository';
import { ConsultationsService } from './consultations.service';
import type { CreateConsultationRequestDto } from './dto/create-consultation-request.dto';

const CLIENT_ID = 'client-1';
const MEMBER_ID = 'member-1';

function caller(id: string, overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id,
    email: `${id}@example.com`,
    role: id.startsWith('member') ? 'member' : 'client',
    status: 'active',
    memberStatus: id.startsWith('member') ? 'active' : null,
    firstName: 'F',
    lastName: 'L',
    ...overrides,
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    id: 'req-1',
    requesterId: CLIENT_ID,
    memberId: MEMBER_ID,
    status: 'pending',
    rating: null,
    ...overrides,
  };
}

type RepoMock = { [K in keyof ConsultationsRepository]: Mock };

function setup(existing = request()) {
  const repo = {
    findById: vi.fn().mockResolvedValue(existing),
    updateStatus: vi.fn().mockResolvedValue({ ...existing, status: 'completed' }),
    updateRating: vi.fn().mockResolvedValue({ ...existing, rating: 5 }),
    findProfileRole: vi.fn().mockResolvedValue({ role: 'member', status: 'active' }),
    isMemberProfileActive: vi.fn().mockResolvedValue(true),
    isMemberService: vi.fn().mockResolvedValue(true),
    findLatestPendingToMember: vi.fn().mockResolvedValue(null),
    countByRequesterSince: vi.fn().mockResolvedValue(0),
    insert: vi.fn().mockResolvedValue(request()),
    insertMessage: vi.fn(),
    findProfilesByIds: vi.fn().mockResolvedValue(new Map()),
  } as unknown as RepoMock;
  return { service: new ConsultationsService(repo as unknown as ConsultationsRepository), repo };
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  return promise.then(
    () => 'OK',
    (err: { getStatus(): number; getResponse(): { code: string } }) => `${err.getStatus()} ${err.getResponse().code}`
  );
}

const decision = { status: 'completed' as const, responseMessage: 'Happy to help — call booked.' };

describe('ConsultationsService.update — rating', () => {
  it('lets the requester rate a completed consultation once', async () => {
    const { service, repo } = setup(request({ status: 'completed' }));
    expect(await codeOf(service.update('req-1', caller(CLIENT_ID), { rating: 5 }))).toBe('OK');
    expect(repo.updateRating).toHaveBeenCalledWith('req-1', CLIENT_ID, 5);
  });

  it('refuses a second rating with 409 RATING_ALREADY_SET', async () => {
    const { service, repo } = setup(request({ status: 'completed', rating: 4 }));
    expect(await codeOf(service.update('req-1', caller(CLIENT_ID), { rating: 5 }))).toBe('409 RATING_ALREADY_SET');
    expect(repo.updateRating).not.toHaveBeenCalled();
  });

  it('reports RATING_ALREADY_SET when it loses a race with a concurrent rating', async () => {
    const { service, repo } = setup(request({ status: 'completed' }));
    repo.updateRating.mockResolvedValue(null);
    repo.findById
      .mockResolvedValueOnce(request({ status: 'completed' }))
      .mockResolvedValueOnce(request({ status: 'completed', rating: 3 }));
    expect(await codeOf(service.update('req-1', caller(CLIENT_ID), { rating: 5 }))).toBe('409 RATING_ALREADY_SET');
  });

  it.each(['pending', 'declined'])('refuses to rate a %s consultation', async (status) => {
    const { service } = setup(request({ status }));
    expect(await codeOf(service.update('req-1', caller(CLIENT_ID), { rating: 5 }))).toBe(
      '409 CONSULTATION_NOT_COMPLETED'
    );
  });

  it('refuses a rating from the member (only the requester rates)', async () => {
    const { service } = setup(request({ status: 'completed' }));
    expect(await codeOf(service.update('req-1', caller(MEMBER_ID), { rating: 5 }))).toBe(
      '403 CONSULTATION_NOT_PARTICIPANT'
    );
  });
});

describe('ConsultationsService.update — decision', () => {
  it('lets the receiving member decide', async () => {
    const { service, repo } = setup();
    expect(await codeOf(service.update('req-1', caller(MEMBER_ID), decision))).toBe('OK');
    expect(repo.updateStatus).toHaveBeenCalledWith('req-1', 'completed', decision.responseMessage);
  });

  it('refuses a decision from the requester', async () => {
    const { service, repo } = setup();
    expect(await codeOf(service.update('req-1', caller(CLIENT_ID), decision))).toBe('403 CONSULTATION_NOT_PARTICIPANT');
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('refuses a decision from a different member', async () => {
    const { service } = setup();
    expect(await codeOf(service.update('req-1', caller('member-2'), decision))).toBe(
      '403 CONSULTATION_NOT_PARTICIPANT'
    );
  });

  it('refuses a deactivated member with 403 MEMBER_DEACTIVATED', async () => {
    const { service, repo } = setup();
    const deactivated = caller(MEMBER_ID, { memberStatus: 'deactivated' });
    expect(await codeOf(service.update('req-1', deactivated, decision))).toBe('403 MEMBER_DEACTIVATED');
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('refuses a second decision with 409 CONSULTATION_ALREADY_DECIDED', async () => {
    const { service, repo } = setup();
    repo.updateStatus.mockResolvedValue(null);
    expect(await codeOf(service.update('req-1', caller(MEMBER_ID), decision))).toBe('409 CONSULTATION_ALREADY_DECIDED');
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['an empty body', {}, '400 NOTHING_TO_UPDATE'],
    ['a decision and a rating together', { ...decision, rating: 5 }, '400 MIXED_UPDATE'],
    ['a status without a message', { status: 'completed' }, '400 DECISION_INCOMPLETE'],
  ])('refuses %s', async (_label, dto, code) => {
    const { service } = setup();
    expect(await codeOf(service.update('req-1', caller(MEMBER_ID), dto))).toBe(code);
  });
});

describe('ConsultationsService.create', () => {
  const dto = (overrides: Partial<CreateConsultationRequestDto> = {}): CreateConsultationRequestDto =>
    ({
      memberId: MEMBER_ID,
      name: 'Client',
      email: 'client@example.com',
      phone: '+91 98765 43210',
      message: 'I need help with GST filings for my company.',
      serviceId: 'svc-1',
      ...overrides,
    }) as CreateConsultationRequestDto;

  it('blocks a request to yourself before any DB read', async () => {
    const { service, repo } = setup();
    expect(await codeOf(service.create(caller(MEMBER_ID), dto()))).toBe('400 CONSULTATION_SELF');
    expect(repo.findProfileRole).not.toHaveBeenCalled();
    expect(repo.insert).not.toHaveBeenCalled();
  });

  it('creates a request to an active member', async () => {
    const { service, repo } = setup();
    expect(await codeOf(service.create(caller(CLIENT_ID), dto()))).toBe('OK');
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ requester_id: CLIENT_ID, member_id: MEMBER_ID })
    );
  });

  it.each<[string, Partial<RepoMock>]>([
    ['a non-member', { findProfileRole: vi.fn().mockResolvedValue({ role: 'client', status: 'active' }) }],
    ['a suspended member', { findProfileRole: vi.fn().mockResolvedValue({ role: 'member', status: 'suspended' }) }],
    ['a deactivated listing', { isMemberProfileActive: vi.fn().mockResolvedValue(false) }],
  ])('answers the same CONSULTATION_MEMBER_NOT_FOUND for %s', async (_label, overrides) => {
    const { service, repo } = setup();
    Object.assign(repo, overrides);
    expect(await codeOf(service.create(caller(CLIENT_ID), dto()))).toBe('400 CONSULTATION_MEMBER_NOT_FOUND');
  });

  it("refuses a service the member doesn't offer", async () => {
    const { service, repo } = setup();
    repo.isMemberService.mockResolvedValue(false);
    expect(await codeOf(service.create(caller(CLIENT_ID), dto()))).toBe('400 CONSULTATION_SERVICE_NOT_OFFERED');
  });

  it('refuses a duplicate while one is pending (409) and a burst over the limit (429)', async () => {
    const pending = setup();
    pending.repo.findLatestPendingToMember.mockResolvedValue({ createdAt: new Date().toISOString() });
    expect(await codeOf(pending.service.create(caller(CLIENT_ID), dto()))).toBe('409 CONSULTATION_PENDING_EXISTS');

    const burst = setup();
    burst.repo.countByRequesterSince.mockResolvedValue(3);
    expect(await codeOf(burst.service.create(caller(CLIENT_ID), dto()))).toBe('429 CONSULTATION_RATE_LIMITED');
  });
});

describe('ConsultationsService messages', () => {
  it('refuses a non-participant', async () => {
    const { service } = setup();
    expect(await codeOf(service.listMessages('req-1', caller('client-2')))).toBe('403 CONSULTATION_NOT_PARTICIPANT');
  });

  it('refuses a deactivated member posting in their own thread', async () => {
    const { service, repo } = setup();
    expect(
      await codeOf(service.postMessage('req-1', caller(MEMBER_ID, { memberStatus: 'deactivated' }), { body: 'hi' }))
    ).toBe('403 MEMBER_DEACTIVATED');
    expect(repo.insertMessage).not.toHaveBeenCalled();
  });
});
