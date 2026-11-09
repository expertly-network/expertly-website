// interviews.service.spec.ts
import { describe, expect, it, vi, type Mock } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { InterviewsService } from './interviews.service';
import type { InterviewRow, InterviewsRepository } from './interviews.repository';
import type { Planner } from './brain/planner';
import type { ElevenLabsClient } from './elevenlabs.client';
import type { InterviewConfig } from './interview.config';
import type { AuthenticatedUser } from '../auth/types/auth.types';

const member: AuthenticatedUser = {
  id: 'm1', email: 'm1@x.com', role: 'member', status: 'active', memberStatus: 'active', firstName: 'A', lastName: 'B',
};
const config = { enabled: true, consentVersion: 'v1', maxSeconds: 1800, reconnectHours: 24 } as InterviewConfig;
const PLAN = {
  schemaVersion: 1, opening: 'Hi',
  objectives: [{ id: 'engagement_1', kind: 'signature_engagement', priority: 1, rationale: '', seedQuestions: ['q'], facts: ['outcome'], budgetSeconds: 1260 }],
  knownFacts: [], confirmFacts: [], sensitivities: [],
};

function interview(overrides: Partial<InterviewRow> = {}): InterviewRow {
  return {
    id: 'i1', memberId: 'm1', status: 'ready', consentVersion: 'v1', consentAt: '2026-11-09T10:00:00Z',
    elapsedSeconds: 0, reconnectUntil: null, endedAt: null, plan: PLAN, state: {}, stateVersion: 0,
    drafts: null, assessment: null, summary: null, summaryStatus: null, extractAttempts: 0,
    extractClaimedAt: null, failureReason: null, createdAt: '', updatedAt: '', ...overrides,
  };
}

function setup(current: InterviewRow | null = null, live = false) {
  const repo = {
    loadMemberContext: vi.fn().mockResolvedValue({ memberId: 'm1', services: [] }),
    findCurrent: vi.fn().mockResolvedValue(current),
    insertInterview: vi.fn().mockResolvedValue(interview({ plan: null })),
    updateInterview: vi.fn().mockImplementation((_id: string, patch: Partial<InterviewRow>) =>
      Promise.resolve(interview({ ...(current ?? {}), ...patch }))
    ),
    findLiveConnection: vi.fn().mockResolvedValue(live ? { id: 'c0' } : null),
    insertConnection: vi.fn().mockResolvedValue({ id: 'c1' }),
  } as unknown as { [K in keyof InterviewsRepository]: Mock };
  const planner = { plan: vi.fn().mockResolvedValue(PLAN) };
  const el = { conversationToken: vi.fn().mockResolvedValue('tok') };
  const service = new InterviewsService(
    repo as unknown as InterviewsRepository,
    planner as unknown as Planner,
    el as unknown as ElevenLabsClient,
    config
  );
  return { service, repo, planner, el };
}

describe('InterviewsService.start', () => {
  it('creates the interview, plans once and opens connection 1', async () => {
    const { service, repo, planner } = setup(null);
    const res = await service.start(member, { consentVersion: 'v1' });
    expect(repo.insertInterview).toHaveBeenCalled();
    expect(planner.plan).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ interviewId: 'i1', connectionId: 'c1', conversationToken: 'tok', maxSeconds: 1800 });
    expect(res.sessionToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const conn = repo.insertConnection.mock.calls[0][0] as { tokenHash: string };
    expect(conn.tokenHash).not.toBe(res.sessionToken);
  });
  it('reconnects inside the window without re-planning, with the remaining budget', async () => {
    const { service, planner } = setup(
      interview({ status: 'interrupted', reconnectUntil: new Date(Date.now() + 3_600_000).toISOString(), elapsedSeconds: 600 })
    );
    const res = await service.start(member, { consentVersion: 'v1' });
    expect(planner.plan).not.toHaveBeenCalled();
    expect(res.maxSeconds).toBe(1200);
  });
  it('rejects a completed interview', async () => {
    const { service } = setup(interview({ status: 'completed' }));
    await expect(service.start(member, { consentVersion: 'v1' })).rejects.toMatchObject({
      response: { code: 'INTERVIEW_ALREADY_TAKEN' },
    });
  });
  it('rejects while a connection is live', async () => {
    const { service } = setup(interview({ status: 'in_progress' }), true);
    await expect(service.start(member, { consentVersion: 'v1' })).rejects.toBeInstanceOf(ConflictException);
  });
  it('rejects a stale consent version', async () => {
    const { service } = setup(null);
    await expect(service.start(member, { consentVersion: 'old' })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('rejects a non-active member', async () => {
    const { service } = setup(null);
    await expect(service.start({ ...member, memberStatus: 'deactivated' }, { consentVersion: 'v1' })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
  it('is unavailable when not configured', async () => {
    const { repo, planner, el } = setup(null);
    const off = new InterviewsService(
      repo as unknown as InterviewsRepository,
      planner as unknown as Planner,
      el as unknown as ElevenLabsClient,
      { ...config, enabled: false } as InterviewConfig
    );
    await expect(off.start(member, { consentVersion: 'v1' })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('InterviewsService.updateSummary', () => {
  it('approves an edited summary on a completed interview, redacting contact details', async () => {
    const { service, repo } = setup(interview({ status: 'completed', summary: 'x'.repeat(30), summaryStatus: 'pending' }));
    await service.updateSummary(member, { summary: 'Experienced TP advisor. Reach me at asha@example.com anytime.', approve: true });
    const patch = repo.updateInterview.mock.calls[0][1] as { summary: string; summaryStatus: string };
    expect(patch.summaryStatus).toBe('approved');
    expect(patch.summary).not.toContain('asha@example.com');
  });
  it('refuses when an admin hid it', async () => {
    const { service } = setup(interview({ status: 'completed', summaryStatus: 'hidden' }));
    await expect(service.updateSummary(member, { summary: 'y'.repeat(40), approve: true })).rejects.toMatchObject({
      response: { code: 'INTERVIEW_SUMMARY_HIDDEN' },
    });
  });
});
