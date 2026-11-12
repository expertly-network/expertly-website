// interviews.service.spec.ts
import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import type { InterviewRow, InterviewsRepository } from './interviews.repository';
import type { InterviewResultsRepository } from './interview-results.repository';
import type { Preparer } from './brain/preparer';
import type { ElevenLabsClient } from './elevenlabs.client';
import type { InterviewConfig } from './interview.config';
import type { AuthenticatedUser } from '../auth/types/auth.types';

const MEMBER_USER: AuthenticatedUser = {
  id: 'm1',
  email: 'm1@x.com',
  role: 'member',
  status: 'active',
  memberStatus: 'active',
  firstName: 'A',
  lastName: 'B',
};
const CONSENT = 'v1';
const config = { enabled: true, consentVersion: CONSENT, maxSeconds: 1800, reconnectHours: 24 } as InterviewConfig;
const LEDGER = { claims: [] };
const PLAN = { schemaVersion: 2, baselineClaimId: 'c1', claimIds: ['c1'], opening: 'O' };

function interview(overrides: Partial<InterviewRow> = {}): InterviewRow {
  return {
    id: 'i1',
    memberId: 'm1',
    status: 'ready',
    consentVersion: CONSENT,
    consentAt: '2026-11-09T10:00:00Z',
    elapsedSeconds: 0,
    reconnectUntil: null,
    endedAt: null,
    plan: PLAN,
    state: {},
    stateVersion: 0,
    drafts: null,
    ledger: LEDGER,
    audioOptIn: false,
    verifiedAt: null,
    llmUsage: {},
    summary: null,
    summaryStatus: null,
    extractAttempts: 0,
    extractClaimedAt: null,
    failureReason: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const COMPLETED_ROW = interview({
  status: 'completed',
  verifiedAt: null,
  audioOptIn: false,
  ledger: LEDGER,
  llmUsage: {},
});

function setup(current: InterviewRow | null = null, live = false) {
  const repo = {
    loadMemberContext: vi.fn().mockResolvedValue({ memberId: 'm1', services: [] }),
    loadTaxonomy: vi.fn().mockResolvedValue([]),
    findCurrent: vi.fn().mockResolvedValue(current),
    insertInterview: vi.fn().mockResolvedValue(interview({ plan: null, ledger: null })),
    updateInterview: vi
      .fn()
      .mockImplementation((_id: string, patch: Partial<InterviewRow>) =>
        Promise.resolve(interview({ ...(current ?? {}), ...patch }))
      ),
    findLiveConnection: vi.fn().mockResolvedValue(live ? { id: 'c0' } : null),
    insertConnection: vi.fn().mockResolvedValue({ id: 'c1' }),
  } as unknown as { [K in keyof InterviewsRepository]: Mock };
  const preparer = { prepare: vi.fn().mockResolvedValue({ ledger: LEDGER, plan: PLAN }) };
  const results = {
    listProposals: vi.fn().mockResolvedValue([]),
    memberApprove: vi.fn(),
    listFlagsForInterview: vi.fn().mockResolvedValue([]),
    findCurrentScoring: vi.fn().mockResolvedValue(null),
  } as unknown as { [K in keyof InterviewResultsRepository]: Mock };
  const el = { conversationToken: vi.fn().mockResolvedValue('tok') };
  const service = new InterviewsService(
    repo as unknown as InterviewsRepository,
    preparer as unknown as Preparer,
    results as unknown as InterviewResultsRepository,
    el as unknown as ElevenLabsClient,
    config
  );
  return { service, repo, preparer, results, el };
}

describe('InterviewsService.start', () => {
  it('creates the interview, prepares the ledger+plan once and opens connection 1', async () => {
    const { service, repo, preparer } = setup(null);
    const res = await service.start(MEMBER_USER, { consentVersion: CONSENT });
    expect(repo.insertInterview).toHaveBeenCalled();
    expect(preparer.prepare).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ interviewId: 'i1', connectionId: 'c1', conversationToken: 'tok', maxSeconds: 1800 });
    expect(res.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const conn = repo.insertConnection.mock.calls[0][0] as { tokenHash: string };
    expect(conn.tokenHash).not.toBe(res.sessionToken);
  });
  it('start stores the audio opt-in and prepares ledger + plan with an initial ladder state', async () => {
    const { service, repo, preparer } = setup(null);
    await service.start(MEMBER_USER, { consentVersion: CONSENT, audioOptIn: true });
    expect(repo.insertInterview).toHaveBeenCalledWith(expect.objectContaining({ audioOptIn: true }));
    expect(preparer.prepare).toHaveBeenCalled();
    expect(repo.updateInterview).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        ledger: LEDGER,
        state: expect.objectContaining({ version: 2, currentClaimId: 'c1', step: 1 }),
      })
    );
  });
  it('reconnects inside the window without re-planning, with the remaining budget', async () => {
    const { service, preparer } = setup(
      interview({
        status: 'interrupted',
        reconnectUntil: new Date(Date.now() + 3_600_000).toISOString(),
        elapsedSeconds: 600,
      })
    );
    const res = await service.start(MEMBER_USER, { consentVersion: CONSENT });
    expect(preparer.prepare).not.toHaveBeenCalled();
    expect(res.maxSeconds).toBe(1200);
  });
  it('rejects a completed interview', async () => {
    const { service } = setup(interview({ status: 'completed' }));
    await expect(service.start(MEMBER_USER, { consentVersion: CONSENT })).rejects.toMatchObject({
      response: { code: 'INTERVIEW_ALREADY_TAKEN' },
    });
  });
  it('rejects while a connection is live', async () => {
    const { service } = setup(interview({ status: 'in_progress' }), true);
    await expect(service.start(MEMBER_USER, { consentVersion: CONSENT })).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects a stale consent version', async () => {
    const { service } = setup(null);
    await expect(service.start(MEMBER_USER, { consentVersion: 'old' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a non-active member', async () => {
    const { service } = setup(null);
    await expect(
      service.start({ ...MEMBER_USER, memberStatus: 'deactivated' }, { consentVersion: CONSENT })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('is unavailable when not configured', async () => {
    const { repo, preparer, results, el } = setup(null);
    const off = new InterviewsService(
      repo as unknown as InterviewsRepository,
      preparer as unknown as Preparer,
      results as unknown as InterviewResultsRepository,
      el as unknown as ElevenLabsClient,
      { ...config, enabled: false } as InterviewConfig
    );
    await expect(off.start(MEMBER_USER, { consentVersion: CONSENT })).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});

describe('InterviewsService.getMine', () => {
  it('includes proposals and the verified flag only once completed', async () => {
    const { service, results } = setup({ ...COMPLETED_ROW, verifiedAt: '2026-11-12T10:00:00Z' });
    (results.listProposals as ReturnType<typeof vi.fn>).mockResolvedValue([{ serviceId: 's1' }]);
    const out = await service.getMine(MEMBER_USER);
    expect(out.interview?.verified).toBe(true);
    expect(out.interview?.proposedServices).toEqual([{ serviceId: 's1' }]);
  });
  it('omits proposals and verified when not completed', async () => {
    const { service, results } = setup(interview({ status: 'ready' }));
    const out = await service.getMine(MEMBER_USER);
    expect(out.interview?.verified).toBe(false);
    expect(out.interview?.proposedServices).toEqual([]);
    expect(results.listProposals).not.toHaveBeenCalled();
  });
});

describe('InterviewsService.updateSummary', () => {
  it('approves an edited summary on a completed interview, redacting contact details', async () => {
    const { service, repo } = setup(
      interview({ status: 'completed', summary: 'x'.repeat(30), summaryStatus: 'pending' })
    );
    await service.updateSummary(MEMBER_USER, {
      summary: 'Experienced TP advisor. Reach me at asha@example.com anytime.',
      approve: true,
    });
    const patch = repo.updateInterview.mock.calls[0][1] as { summary: string; summaryStatus: string };
    expect(patch.summaryStatus).toBe('approved');
    expect(patch.summary).not.toContain('asha@example.com');
  });
  it('refuses when an admin hid it', async () => {
    const { service } = setup(interview({ status: 'completed', summaryStatus: 'hidden' }));
    await expect(service.updateSummary(MEMBER_USER, { summary: 'y'.repeat(40), approve: true })).rejects.toMatchObject({
      response: { code: 'INTERVIEW_SUMMARY_HIDDEN' },
    });
  });
});

describe('InterviewsService.updateMySubtags', () => {
  it('requires a completed interview and approves via the repository', async () => {
    const { service, results } = setup(COMPLETED_ROW);
    await service.updateMySubtags(MEMBER_USER, { services: [] });
    expect(results.memberApprove).toHaveBeenCalledWith(MEMBER_USER.id, COMPLETED_ROW.id, []);
    const { service: svc2 } = setup({ ...COMPLETED_ROW, status: 'processing' });
    await expect(svc2.updateMySubtags(MEMBER_USER, { services: [] })).rejects.toMatchObject({
      response: { code: 'INTERVIEW_NOT_COMPLETED' },
    });
  });
  it('redacts contact details from an edited evidence summary before storing', async () => {
    const { service, results } = setup(COMPLETED_ROW);
    await service.updateMySubtags(MEMBER_USER, {
      services: [
        {
          serviceId: 's1',
          removeFacetValueIds: [],
          evidenceSummary: 'Great work, reach me at asha@example.com for more.',
        },
      ],
    });
    const edits = (results.memberApprove as ReturnType<typeof vi.fn>).mock.calls[0][2] as {
      evidenceSummary: string | null;
    }[];
    expect(edits[0].evidenceSummary).not.toContain('asha@example.com');
  });
  it('keeps the redacted summary within 400 characters (redaction can lengthen it)', async () => {
    const { service, results } = setup(COMPLETED_ROW);
    await service.updateMySubtags(MEMBER_USER, {
      services: [{ serviceId: 's1', removeFacetValueIds: [], evidenceSummary: `${'a'.repeat(390)} x@y.io` }],
    });
    const edits = (results.memberApprove as ReturnType<typeof vi.fn>).mock.calls[0][2] as {
      evidenceSummary: string | null;
    }[];
    expect(edits[0].evidenceSummary?.length).toBeLessThanOrEqual(400);
    expect(edits[0].evidenceSummary).not.toContain('x@y.io');
  });
});

describe('InterviewsService admin', () => {
  it('redo re-checks the admin role fresh, then voids the interview', async () => {
    const { service, repo } = setup(interview({ status: 'completed' }));
    (repo as unknown as { findById: Mock }).findById = vi.fn().mockResolvedValue(interview({ status: 'completed' }));
    (repo as unknown as { findProfileRole: Mock }).findProfileRole = vi
      .fn()
      .mockResolvedValue({ role: 'admin', status: 'active' });
    await service.adminRedo({ ...MEMBER_USER, id: 'admin1', role: 'admin' }, 'i1');
    expect(repo.updateInterview).toHaveBeenCalledWith('i1', { status: 'voided' });
  });
  it('redo refuses when the fresh role is no longer admin', async () => {
    const { service, repo } = setup();
    (repo as unknown as { findById: Mock }).findById = vi.fn().mockResolvedValue(interview({ status: 'completed' }));
    (repo as unknown as { findProfileRole: Mock }).findProfileRole = vi
      .fn()
      .mockResolvedValue({ role: 'member', status: 'active' });
    await expect(service.adminRedo({ ...MEMBER_USER, role: 'admin' }, 'i1')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('hiding sets summaryStatus hidden; unhiding returns it to pending for the member to re-approve', async () => {
    const { service, repo } = setup();
    const findById = vi.fn().mockResolvedValue(interview({ status: 'completed', summaryStatus: 'approved' }));
    Object.assign(repo, {
      findById,
      listConnections: vi.fn().mockResolvedValue([]),
      findMemberName: vi.fn().mockResolvedValue('A B'),
    });
    await service.adminSetSummaryHidden('i1', true);
    expect(repo.updateInterview).toHaveBeenCalledWith('i1', { summaryStatus: 'hidden' });
    await service.adminSetSummaryHidden('i1', false);
    expect(repo.updateInterview).toHaveBeenCalledWith('i1', { summaryStatus: 'pending' });
  });
  it('list items report hasScoring and verifiedAt instead of the old assessment flag', async () => {
    const { service, repo } = setup();
    (repo as unknown as { adminList: Mock }).adminList = vi.fn().mockResolvedValue({
      rows: [{ ...interview({ status: 'completed', verifiedAt: '2026-11-12T10:00:00Z' }), memberName: 'A B' }],
      total: 1,
    });
    const out = await service.adminList({});
    expect(out.items[0]).toMatchObject({ hasScoring: true, verifiedAt: '2026-11-12T10:00:00Z' });
  });
});
