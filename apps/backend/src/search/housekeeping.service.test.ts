import { describe, expect, it, vi } from 'vitest';
import { HousekeepingService } from './housekeeping.service';
import type { SearchRepository } from './search.repository';

describe('HousekeepingService', () => {
  it('uses 7 / 30 / 365 day cutoffs, like search_housekeeping()', async () => {
    const repo = {
      deleteProcessedOutboxBefore: vi.fn().mockResolvedValue(3),
      deleteQueryLogsBefore: vi.fn().mockResolvedValue(2),
    };
    const now = new Date('2026-10-12T00:00:00Z');
    const result = await new HousekeepingService(repo as unknown as SearchRepository).run(now);
    expect(result).toEqual({ outbox: 3, queryLog: 2 });
    expect(repo.deleteProcessedOutboxBefore).toHaveBeenCalledWith(new Date('2026-10-05T00:00:00Z'));
    expect(repo.deleteQueryLogsBefore).toHaveBeenCalledWith(new Date('2026-09-12T00:00:00Z'), new Date('2025-10-12T00:00:00Z'));
  });
});
