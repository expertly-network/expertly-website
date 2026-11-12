import { describe, expect, it, vi } from 'vitest';
import { InterviewReviewService } from './interview-review.service';
import type { InterviewResultsRepository } from './interview-results.repository';
import type { InterviewsRepository } from './interviews.repository';
import type { InterviewScoringService } from './interview-scoring.service';
import type { InterviewsService } from './interviews.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';

const ADMIN = { id: 'admin1', role: 'admin' } as AuthenticatedUser;

function setup(o: { role?: string; status?: string } = {}) {
  const repo = {
    findProfileRole: vi.fn().mockResolvedValue({ role: o.role ?? 'admin', status: 'active' }),
    findById: vi
      .fn()
      .mockResolvedValue({ id: 'i1', memberId: 'm1', status: o.status ?? 'completed', plan: {}, ledger: {} }),
    listConnections: vi.fn().mockResolvedValue([{ transcript: [{ role: 'user', message: 'x', timeInCallSecs: 0 }] }]),
    loadMemberContext: vi.fn().mockResolvedValue({ memberId: 'm1', services: [] }),
    updateInterview: vi.fn(),
    findMemberName: vi.fn().mockResolvedValue('Asha Rao'),
  } as unknown as InterviewsRepository;
  const results = {
    resolveFlag: vi.fn().mockResolvedValue({ id: 'f1', memberId: 'm1' }),
    applyAdminDecision: vi.fn(),
    listMemberEvidence: vi.fn().mockResolvedValue([]),
    // Validation read for decideSubtags — only 's1' has interview evidence by default.
    listEvidenceServiceIds: vi.fn().mockResolvedValue(['s1']),
  } as unknown as InterviewResultsRepository;
  const scoring = {
    scoreAndStore: vi.fn().mockResolvedValue({ scoringId: 's2', result: {}, verified: false }),
  } as unknown as InterviewScoringService;
  const interviews = { adminGet: vi.fn().mockResolvedValue({ id: 'i1' }) } as unknown as InterviewsService;
  return { svc: new InterviewReviewService(repo, results, scoring, interviews), repo, results, scoring };
}

describe('InterviewReviewService', () => {
  it('rescore re-runs the scorer without reuse and refreshes verified', async () => {
    const { svc, scoring, repo } = setup();
    await svc.rescore('i1');
    expect(scoring.scoreAndStore).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      expect.any(Array),
      expect.any(Object)
    );
    expect(repo.updateInterview).toHaveBeenCalledWith('i1', { verifiedAt: null });
  });

  it('rescore refuses interviews that are not completed', async () => {
    const { svc } = setup({ status: 'processing' });
    await expect(svc.rescore('i1')).rejects.toMatchObject({ response: { code: 'INTERVIEW_NOT_COMPLETED' } });
  });

  it('resolving a flag re-checks the admin role fresh', async () => {
    const { svc, results } = setup({ role: 'member' });
    await expect(svc.resolveFlag(ADMIN, 'f1', { status: 'dismissed' })).rejects.toMatchObject({
      response: { code: 'ADMIN_REQUIRED' },
    });
    expect(results.resolveFlag).not.toHaveBeenCalled();
  });

  it('resolves a flag with the member name attached', async () => {
    const { svc } = setup();
    await expect(svc.resolveFlag(ADMIN, 'f1', { status: 'confirmed', note: 'Asked member' })).resolves.toMatchObject({
      memberName: 'Asha Rao',
    });
  });

  it('applies each sub-tag decision after the fresh role check', async () => {
    const { svc, results } = setup();
    await svc.decideSubtags(ADMIN, 'm1', { services: [{ serviceId: 's1', accept: true }] });
    expect(results.applyAdminDecision).toHaveBeenCalledWith('m1', { serviceId: 's1', accept: true });
  });

  it('decideSubtags validates every serviceId has evidence before applying any decision', async () => {
    const { svc, results } = setup();
    await expect(
      svc.decideSubtags(ADMIN, 'm1', {
        services: [
          { serviceId: 's1', accept: true },
          { serviceId: 'unknown', accept: true },
        ],
      })
    ).rejects.toMatchObject({ response: { code: 'INTERVIEW_EVIDENCE_NOT_FOUND' } });
    expect(results.applyAdminDecision).not.toHaveBeenCalled();
  });
});
