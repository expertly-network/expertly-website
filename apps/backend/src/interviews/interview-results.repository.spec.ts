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
    it('inserts the new row as not-current, then clears others, then marks it current, in that order', async () => {
      const { service, calls } = fakeSupabaseService((call) => {
        if (call.steps.some((s) => s.method === 'insert')) return { data: { id: 'new-id' } };
        return { data: null };
      });
      const repo = new InterviewResultsRepository(service);

      const id = await repo.insertScoring('interview-1', 'v1', 'gpt-test', EMPTY_RESULT);

      expect(id).toBe('new-id');
      expect(calls).toHaveLength(3);
      expect(calls.every((c) => c.table === 'interview_scorings')).toBe(true);

      // Step 1: insert the new row as not-current.
      expect(calls[0].steps.map((s) => s.method)).toContain('insert');
      expect((argsOf(calls[0], 'insert')?.[0] as { is_current: boolean }).is_current).toBe(false);

      // Step 2: clear every other row for this interview — never the new row itself.
      expect(calls[1].steps.map((s) => s.method)).toContain('update');
      expect((argsOf(calls[1], 'update')?.[0] as { is_current: boolean }).is_current).toBe(false);
      expect(argsOf(calls[1], 'eq')).toEqual(['interview_id', 'interview-1']);
      expect(argsOf(calls[1], 'neq')).toEqual(['id', 'new-id']);

      // Step 3: mark the new row current.
      expect(calls[2].steps.map((s) => s.method)).toContain('update');
      expect((argsOf(calls[2], 'update')?.[0] as { is_current: boolean }).is_current).toBe(true);
      expect(argsOf(calls[2], 'eq')).toEqual(['id', 'new-id']);
    });

    it('throws a DB error and never clears other rows when the insert fails', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ error: { message: 'insert boom' } }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.insertScoring('interview-1', 'v1', 'gpt-test', EMPTY_RESULT)).rejects.toMatchObject({
        response: { code: 'INTERVIEW_DB_ERROR' },
      });
      // Only the insert attempt happened — the two update steps never ran.
      expect(calls).toHaveLength(1);
    });
  });

  describe('findCurrentScoring', () => {
    it('returns the row flagged current without a fallback query', async () => {
      const { service, calls } = fakeSupabaseService((call) => {
        if (call.steps.some((s) => s.method === 'eq' && s.args[0] === 'is_current')) {
          return { data: { id: 'current-id', result: EMPTY_RESULT } };
        }
        throw new Error('fallback query should not run');
      });
      const repo = new InterviewResultsRepository(service);

      await expect(repo.findCurrentScoring('interview-1')).resolves.toEqual({
        id: 'current-id',
        result: EMPTY_RESULT,
      });
      expect(calls).toHaveLength(1);
    });

    it('falls back to the newest row when no row is marked current', async () => {
      const { service, calls } = fakeSupabaseService((call) => {
        const isCurrentLookup = call.steps.some((s) => s.method === 'eq' && s.args[0] === 'is_current');
        if (isCurrentLookup) return { data: null };
        return { data: { id: 'latest-id', result: EMPTY_RESULT } };
      });
      const repo = new InterviewResultsRepository(service);

      await expect(repo.findCurrentScoring('interview-1')).resolves.toEqual({
        id: 'latest-id',
        result: EMPTY_RESULT,
      });
      expect(calls).toHaveLength(2);
      expect(argsOf(calls[1], 'order')).toEqual(['created_at', { ascending: false }]);
      expect(argsOf(calls[1], 'limit')).toEqual([1]);
    });

    it('returns null when there is no row at all for the interview', async () => {
      const { service } = fakeSupabaseService(() => ({ data: null }));
      const repo = new InterviewResultsRepository(service);

      await expect(repo.findCurrentScoring('interview-1')).resolves.toBeNull();
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
    it('rejects an edit with no open proposal and performs no delete/update writes', async () => {
      const { service, calls } = fakeSupabaseService((call) => {
        if (call.table === 'member_service_evidence' && call.steps.some((s) => s.method === 'select')) {
          return { data: [{ service_id: 'valid-svc' }] };
        }
        return { data: null };
      });
      const repo = new InterviewResultsRepository(service);

      await expect(
        repo.memberApprove('m1', 'i1', [
          { serviceId: 'valid-svc', removeFacetValueIds: [], evidenceSummary: null },
          { serviceId: 'invalid-svc', removeFacetValueIds: [], evidenceSummary: null },
        ])
      ).rejects.toMatchObject({ response: { code: 'INTERVIEW_SUBTAGS_NOT_PROPOSED' } });

      // Only the initial proposed-set read happened — validation ran before any write.
      expect(calls).toHaveLength(1);
      expect(calls[0].table).toBe('member_service_evidence');
      expect(calls[0].steps.map((s) => s.method)).toContain('select');
    });

    it('scopes every write by member_id and approves sub-tags before evidence', async () => {
      const { service, calls } = fakeSupabaseService((call) => {
        if (call.table === 'member_service_evidence' && call.steps.some((s) => s.method === 'select')) {
          return { data: [{ service_id: 's1' }, { service_id: 's2' }] };
        }
        return { data: null };
      });
      const repo = new InterviewResultsRepository(service);

      await repo.memberApprove('m1', 'i1', [
        { serviceId: 's1', removeFacetValueIds: ['fv1'], evidenceSummary: 'rewritten summary' },
        { serviceId: 's2', removeFacetValueIds: [], evidenceSummary: null },
      ]);

      // Every write call (every call after the initial select) is scoped to this member.
      const writes = calls.slice(1);
      expect(writes.length).toBeGreaterThan(0);
      for (const call of writes) {
        expect(call.steps.some((s) => s.method === 'eq' && s.args[0] === 'member_id' && s.args[1] === 'm1')).toBe(true);
      }

      const subtagsApproveIndex = calls.findIndex(
        (c) =>
          c.table === 'member_service_subtags' &&
          c.steps.some((s) => s.method === 'update' && (s.args[0] as { status: string }).status === 'member_approved')
      );
      const evidenceApproveIndex = calls.findIndex(
        (c) =>
          c.table === 'member_service_evidence' &&
          c.steps.some((s) => s.method === 'update' && (s.args[0] as { status: string }).status === 'member_approved')
      );
      expect(subtagsApproveIndex).toBeGreaterThanOrEqual(0);
      expect(evidenceApproveIndex).toBeGreaterThan(subtagsApproveIndex);

      // The per-edit delete and summary rewrite both happened before either approve update.
      const deleteIndex = calls.findIndex(
        (c) => c.table === 'member_service_subtags' && c.steps[0]?.method === 'delete'
      );
      const summaryUpdateIndex = calls.findIndex(
        (c) =>
          c.table === 'member_service_evidence' &&
          c.steps.some((s) => s.method === 'update' && 'evidence_summary' in (s.args[0] as object))
      );
      expect(deleteIndex).toBeGreaterThanOrEqual(0);
      expect(deleteIndex).toBeLessThan(subtagsApproveIndex);
      expect(summaryUpdateIndex).toBeGreaterThanOrEqual(0);
      expect(summaryUpdateIndex).toBeLessThan(subtagsApproveIndex);
    });

    it('is a no-op when nothing is proposed', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ data: [] }));
      const repo = new InterviewResultsRepository(service);

      await repo.memberApprove('m1', 'i1', []);

      expect(calls).toHaveLength(1);
    });
  });

  describe('listFlagsForInterview', () => {
    it('attaches the member name and filters by interview_id', async () => {
      // fakeDb returns whatever the resolver gives it verbatim (no column-alias translation),
      // so this mirrors the shape the real client hands back after FLAG_COLUMNS' aliasing.
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
            status: 'open',
            resolutionNote: null,
            resolvedAt: null,
            createdAt: '2026-11-12T10:00:00Z',
          },
        ],
      }));
      const repo = new InterviewResultsRepository(service);

      const out = await repo.listFlagsForInterview('i1', 'Asha B');

      expect(out).toEqual([expect.objectContaining({ id: 'flag-1', interviewId: 'i1', memberName: 'Asha B' })]);
      expect(calls).toHaveLength(1);
      expect(argsOf(calls[0], 'eq')).toEqual(['interview_id', 'i1']);
      expect(argsOf(calls[0], 'order')).toEqual(['created_at', { ascending: true }]);
    });

    it("hides an older scoring's still-open flags but keeps resolved ones, and strips the embed", async () => {
      const { service, calls } = fakeSupabaseService(() => ({
        data: [{ id: 'flag-1', memberId: 'm1', status: 'open', interview_scorings: { id: 'sc2' } }],
      }));
      const repo = new InterviewResultsRepository(service);

      const out = await repo.listFlagsForInterview('i1', 'Asha B');

      expect(out[0]).not.toHaveProperty('interview_scorings');
      expect(argsOf(calls[0], 'select')?.[0]).toContain('interview_scorings!left(id)');
      const eqs = calls[0].steps.filter((s) => s.method === 'eq').map((s) => s.args);
      expect(eqs).toContainEqual(['interview_scorings.is_current', true]);
      expect(argsOf(calls[0], 'or')).toEqual(['status.neq.open,interview_scorings.not.is.null']);
    });
  });

  describe('listFlags', () => {
    it('applies the current-scoring-or-resolved filter alongside the status filter', async () => {
      const { service, calls } = fakeSupabaseService(() => ({
        data: [{ id: 'flag-1', memberId: 'm1', status: 'open', interview_scorings: { id: 'sc2' } }],
        count: 1,
      }));
      const repo = new InterviewResultsRepository(service);

      const out = await repo.listFlags({ status: 'open', offset: 0, limit: 25 });

      expect(out).toEqual({ rows: [{ id: 'flag-1', memberId: 'm1', status: 'open' }], total: 1 });
      const eqs = calls[0].steps.filter((s) => s.method === 'eq').map((s) => s.args);
      expect(eqs).toEqual([
        ['interview_scorings.is_current', true],
        ['status', 'open'],
      ]);
      expect(argsOf(calls[0], 'or')).toEqual(['status.neq.open,interview_scorings.not.is.null']);
    });
  });

  describe('deleteStaleProposals', () => {
    it("deletes only this interview's proposed rows from other scorings", async () => {
      const { service, calls } = fakeSupabaseService(() => ({ data: null }));
      const repo = new InterviewResultsRepository(service);

      await repo.deleteStaleProposals('i1', 'sc2');

      expect(calls[0].table).toBe('member_service_evidence');
      expect(calls[0].steps.map((s) => s.method)).toEqual(['delete', 'eq', 'eq', 'neq']);
      expect(calls[0].steps.slice(1).map((s) => s.args)).toEqual([
        ['interview_id', 'i1'],
        ['status', 'proposed'],
        ['scoring_id', 'sc2'],
      ]);
    });
  });

  describe('insertAdminEvidence', () => {
    it('creates the evidence row as active, never overwriting an existing one', async () => {
      const { service, calls } = fakeSupabaseService(() => ({ data: null }));
      const repo = new InterviewResultsRepository(service);

      await repo.insertAdminEvidence({
        memberId: 'm1',
        serviceId: 's1',
        interviewId: 'i1',
        scoringId: 'sc1',
        role: 4,
        evidence: 'E2',
        recencyYear: 2025,
        summary: 'Led an APA.',
      });

      const [row, opts] = argsOf(calls[0], 'upsert') as [Record<string, unknown>, Record<string, unknown>];
      expect(row).toMatchObject({ member_id: 'm1', service_id: 's1', scoring_id: 'sc1', status: 'active' });
      expect(opts).toEqual({ onConflict: 'member_id,service_id', ignoreDuplicates: true });
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
});
