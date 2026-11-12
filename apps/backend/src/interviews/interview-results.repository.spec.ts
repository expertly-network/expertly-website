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
});
