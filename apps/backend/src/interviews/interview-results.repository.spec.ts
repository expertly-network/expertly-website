import type { InterviewScoringResultDto } from '@shared/interview';
import { describe, expect, it } from 'vitest';
import { argsOf, fakeSupabaseService } from '../../test/helpers/fake-supabase';
import { InterviewResultsRepository } from './interview-results.repository';

const EMPTY_RESULT: InterviewScoringResultDto = {
  rubricVersion: 'v1',
  claims: [],
  adjacentServices: [],
  searchTerms: [],
  interviewQuality: { minutes: 0, claimsProbed: 0, endedEarly: false },
};

describe('InterviewResultsRepository', () => {
  describe('insertScoring', () => {
    it('calls the atomic interview_store_scoring rpc with the scoring fields and returns the new id', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ data: 'new-id' }));
      const repo = new InterviewResultsRepository(service);

      const id = await repo.insertScoring('interview-1', 'v1', 'gpt-test', EMPTY_RESULT);

      expect(id).toBe('new-id');
      expect(calls).toHaveLength(1);
      expect(calls[0].table).toBe('rpc:interview_store_scoring');
      const [args] = argsOf(calls[0], 'rpc') as [Record<string, unknown>];
      expect(args).toMatchObject({
        p_interview_id: 'interview-1',
        p_rubric_version: 'v1',
        p_model: 'gpt-test',
      });
      expect(args.p_result).toEqual(EMPTY_RESULT);
    });

    it('throws a coded DB error when the rpc fails', async () => {
      const { service } = fakeSupabaseService(() => ({ error: { message: 'boom' } }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.insertScoring('interview-1', 'v1', 'gpt-test', EMPTY_RESULT)).rejects.toMatchObject({
        response: { code: 'INTERVIEW_DB_ERROR' },
      });
    });
  });

  describe('findCurrentScoring', () => {
    it('returns the row flagged current with a single plain read (no fallback query)', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ data: { id: 'current-id', result: EMPTY_RESULT } }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.findCurrentScoring('interview-1')).resolves.toEqual({
        id: 'current-id',
        result: EMPTY_RESULT,
      });
      expect(calls).toHaveLength(1);
      const eqs = calls[0].steps.filter((s) => s.method === 'eq').map((s) => s.args);
      expect(eqs).toEqual([
        ['interview_id', 'interview-1'],
        ['is_current', true],
      ]);
    });

    it('returns null when there is no current row for the interview', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ data: null }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.findCurrentScoring('interview-1')).resolves.toBeNull();
      expect(calls).toHaveLength(1);
    });

    it('throws a coded DB error when the read fails', async () => {
      const { service } = fakeSupabaseService(() => ({ error: { message: 'boom' } }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.findCurrentScoring('interview-1')).rejects.toMatchObject({
        response: { code: 'INTERVIEW_DB_ERROR' },
      });
    });
  });

  describe('listProposals', () => {
    it('strips trailing punctuation from the service name, excludes rejected sub-tags and matches sub-tags to their own service', async () => {
      const { service } = fakeSupabaseService((call) => {
        if (call.table === 'member_service_evidence') {
          return {
            data: [
              {
                service_id: 's1',
                evidence_summary: 'Led the APA filing.',
                status: 'proposed',
                services: { name: 'Tax Advisory.', categories: { name: 'Tax' } },
              },
            ],
          };
        }
        if (call.table === 'member_service_subtags') {
          return {
            data: [
              {
                service_id: 's1',
                status: 'proposed',
                facet_values: { id: 'fv1', facet: 'jurisdiction', label: 'India' },
              },
              {
                service_id: 's1',
                status: 'rejected',
                facet_values: { id: 'fv2', facet: 'industry', label: 'Banking' },
              },
              { service_id: 's2', status: 'proposed', facet_values: { id: 'fv3', facet: 'scale', label: 'Large' } },
            ],
          };
        }
        return { data: null };
      });
      const repo = new InterviewResultsRepository(service);

      const out = await repo.listProposals('m1', 'i1');

      expect(out).toEqual([
        {
          serviceId: 's1',
          serviceName: 'Tax Advisory',
          categoryName: 'Tax',
          evidenceSummary: 'Led the APA filing.',
          status: 'proposed',
          subtags: [{ facetValueId: 'fv1', facet: 'jurisdiction', label: 'India' }],
        },
      ]);
    });
  });

  describe('memberApprove', () => {
    it('calls the atomic interview_member_approve rpc with memberId, interviewId and the edits', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ error: null }));
      const repo = new InterviewResultsRepository(service);

      await repo.memberApprove('m1', 'i1', [
        { serviceId: 's1', removeFacetValueIds: ['fv1'], evidenceSummary: 'rewritten summary' },
      ]);

      expect(calls).toHaveLength(1);
      expect(calls[0].table).toBe('rpc:interview_member_approve');
      const [args] = argsOf(calls[0], 'rpc') as [Record<string, unknown>];
      expect(args).toEqual({
        p_member_id: 'm1',
        p_interview_id: 'i1',
        p_edits: [{ serviceId: 's1', removeFacetValueIds: ['fv1'], evidenceSummary: 'rewritten summary' }],
      });
    });

    it('maps the INTERVIEW_SUBTAGS_NOT_PROPOSED raised message to a 400', async () => {
      const { service } = fakeSupabaseService(() => ({ error: { message: 'INTERVIEW_SUBTAGS_NOT_PROPOSED' } }));
      const repo = new InterviewResultsRepository(service);

      await expect(
        repo.memberApprove('m1', 'i1', [{ serviceId: 'invalid-svc', removeFacetValueIds: [], evidenceSummary: null }])
      ).rejects.toMatchObject({ response: { code: 'INTERVIEW_SUBTAGS_NOT_PROPOSED' } });
    });

    it('throws a generic coded DB error for any other rpc failure', async () => {
      const { service } = fakeSupabaseService(() => ({ error: { message: 'boom' } }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.memberApprove('m1', 'i1', [])).rejects.toMatchObject({
        response: { code: 'INTERVIEW_DB_ERROR' },
      });
    });
  });

  describe('listFlagsForInterview', () => {
    it('attaches the member name, filters only by interview_id and returns every status (superseded included, as history)', async () => {
      const { service, calls } = fakeSupabaseService(() => ({
        data: [
          {
            id: 'flag-1',
            interviewId: 'i1',
            memberId: 'm1',
            claimId: 'c1',
            claimText: 'Led 50+ APAs',
            serviceIds: ['s1'],
            reason: 'unsupported',
            evidence: [],
            status: 'superseded',
            resolutionNote: null,
            resolvedAt: null,
            createdAt: '2026-11-12T10:00:00Z',
          },
        ],
      }));
      const repo = new InterviewResultsRepository(service);

      const out = await repo.listFlagsForInterview('i1', 'Asha B');

      expect(out).toEqual([
        expect.objectContaining({ id: 'flag-1', interviewId: 'i1', status: 'superseded', memberName: 'Asha B' }),
      ]);
      expect(calls).toHaveLength(1);
      expect(argsOf(calls[0], 'eq')).toEqual(['interview_id', 'i1']);
      expect(argsOf(calls[0], 'order')).toEqual(['created_at', { ascending: true }]);
      expect(calls[0].steps.some((s) => s.method === 'or')).toBe(false);
      expect(argsOf(calls[0], 'select')?.[0]).not.toContain('interview_scorings');
    });
  });

  describe('listFlags', () => {
    it('filters only by the status query param, with no embed filter', async () => {
      const { service, calls } = fakeSupabaseService(() => ({
        data: [{ id: 'flag-1', memberId: 'm1', status: 'open' }],
        count: 1,
      }));
      const repo = new InterviewResultsRepository(service);

      const out = await repo.listFlags({ status: 'open', offset: 0, limit: 25 });

      expect(out).toEqual({ rows: [{ id: 'flag-1', memberId: 'm1', status: 'open' }], total: 1 });
      const eqs = calls[0].steps.filter((s) => s.method === 'eq').map((s) => s.args);
      expect(eqs).toEqual([['status', 'open']]);
      expect(calls[0].steps.some((s) => s.method === 'or')).toBe(false);
      expect(argsOf(calls[0], 'select')?.[0]).not.toContain('interview_scorings');
    });

    it('omits the status filter entirely when none is given (every status, including superseded)', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ data: [], count: 0 }));
      const repo = new InterviewResultsRepository(service);

      await repo.listFlags({ offset: 0, limit: 25 });

      const eqs = calls[0].steps.filter((s) => s.method === 'eq').map((s) => s.args);
      expect(eqs).toEqual([]);
    });
  });

  describe('resolveFlag', () => {
    it('updates and returns an open flag', async () => {
      const { service, calls } = fakeSupabaseService((call) => {
        if (call.steps.some((s) => s.method === 'update')) {
          return { data: { id: 'f1', memberId: 'm1', status: 'dismissed' } };
        }
        return { data: null };
      });
      const repo = new InterviewResultsRepository(service);

      await expect(repo.resolveFlag('f1', 'dismissed', null, 'admin1')).resolves.toMatchObject({
        id: 'f1',
        status: 'dismissed',
      });
      expect(calls).toHaveLength(1);
      const eqs = calls[0].steps.filter((s) => s.method === 'eq').map((s) => s.args);
      expect(eqs).toEqual([
        ['id', 'f1'],
        ['status', 'open'],
      ]);
    });

    it('throws 404 when the flag does not exist at all', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ data: null }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.resolveFlag('missing', 'dismissed', null, 'admin1')).rejects.toMatchObject({
        response: { code: 'INTERVIEW_FLAG_NOT_FOUND' },
      });
      expect(calls).toHaveLength(2);
    });

    it('throws 409 INTERVIEW_FLAG_NOT_OPEN when the flag exists but is not open', async () => {
      const { service, calls } = fakeSupabaseService((call) => {
        if (call.steps.some((s) => s.method === 'update')) return { data: null };
        return { data: { status: 'confirmed' } };
      });
      const repo = new InterviewResultsRepository(service);

      await expect(repo.resolveFlag('f1', 'dismissed', null, 'admin1')).rejects.toMatchObject({
        response: { code: 'INTERVIEW_FLAG_NOT_OPEN' },
      });
      expect(calls).toHaveLength(2);
    });
  });

  describe('createFacetValue', () => {
    it('rejects a label with no sluggable characters before any write', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ data: null }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.createFacetValue('instrument', '—', [])).rejects.toMatchObject({
        response: { code: 'FACET_VALUE_INVALID' },
      });
      expect(calls).toHaveLength(0);
    });
  });

  describe('adminDecideSubtags', () => {
    it('calls the atomic interview_admin_decide_subtags rpc with decisions and seed evidence (no memberId repeated in the seed rows)', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ error: null }));
      const repo = new InterviewResultsRepository(service);

      await repo.adminDecideSubtags(
        'm1',
        [{ serviceId: 's1', accept: true }],
        [
          {
            memberId: 'm1',
            serviceId: 's-tp',
            interviewId: 'i1',
            scoringId: 'sc9',
            role: 0,
            evidence: 'E2',
            recencyYear: 2024,
            summary: 'Led the transfer pricing study.',
          },
        ]
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].table).toBe('rpc:interview_admin_decide_subtags');
      const [args] = argsOf(calls[0], 'rpc') as [Record<string, unknown>];
      expect(args.p_member_id).toBe('m1');
      expect(args.p_decisions).toEqual([{ serviceId: 's1', accept: true }]);
      expect(args.p_seed_evidence).toEqual([
        {
          serviceId: 's-tp',
          interviewId: 'i1',
          scoringId: 'sc9',
          role: 0,
          evidence: 'E2',
          recencyYear: 2024,
          summary: 'Led the transfer pricing study.',
        },
      ]);
    });

    it('maps the INTERVIEW_EVIDENCE_NOT_FOUND raised message to a 404', async () => {
      const { service } = fakeSupabaseService(() => ({ error: { message: 'INTERVIEW_EVIDENCE_NOT_FOUND' } }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.adminDecideSubtags('m1', [{ serviceId: 'unknown', accept: true }], [])).rejects.toMatchObject({
        response: { code: 'INTERVIEW_EVIDENCE_NOT_FOUND' },
      });
    });

    it('throws a generic coded DB error for any other rpc failure', async () => {
      const { service } = fakeSupabaseService(() => ({ error: { message: 'boom' } }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.adminDecideSubtags('m1', [], [])).rejects.toMatchObject({
        response: { code: 'INTERVIEW_DB_ERROR' },
      });
    });
  });
});
