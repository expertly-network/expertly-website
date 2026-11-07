import { describe, expect, it, vi } from 'vitest';
import { computeDueState, renewalDueDate } from '../members/renewal';
import { RenewalRemindersService } from './renewal-reminders.service';
import { EmailRepository } from './email.repository';
import { EmailService } from './email.service';
describe('renewal reminders', () => {
  it('uses one UTC renewal rule at the window boundaries', () => {
    const start = '2025-12-07T00:00:00Z';
    expect(renewalDueDate(start).toISOString()).toBe('2026-12-07T00:00:00.000Z');
    expect(computeDueState(start, new Date('2026-11-06T23:59:59Z'))).toBe('active');
    expect(computeDueState(start, new Date('2026-11-07T00:00:00Z'))).toBe('due-soon');
    expect(computeDueState(start, new Date('2026-12-07T00:00:00Z'))).toBe('overdue');
  });
  it('prepares once, skips reminders already queued, and keys by due date', async () => {
    const prepared = { key: 'renewal_due_soon' };
    const repo = {
      renewalCandidates: vi
        .fn()
        .mockResolvedValueOnce([
          { id: 'due', membership_started_at: '2025-12-07T00:00:00Z', work_email: 'due@work.example' },
          { id: 'no-work-email', membership_started_at: '2025-12-07T00:00:00Z', work_email: null },
          { id: 'queued-already', membership_started_at: '2025-12-06T00:00:00Z', work_email: 'q@work.example' },
          { id: 'later', membership_started_at: '2026-01-07T00:00:00Z', work_email: 'l@work.example' },
          { id: 'overdue', membership_started_at: '2025-11-01T00:00:00Z', work_email: 'o@work.example' },
        ])
        .mockResolvedValue([]),
      findExistingIdempotencyKeys: vi.fn().mockResolvedValue(new Set(['renewal_due_soon:queued-already:2026-12-06'])),
      findProfiles: vi.fn(async (ids: string[]) =>
        ids.map((id) => ({ id, email: `${id}@example.com`, first_name: '', last_name: '' }))
      ),
    };
    const email = {
      prepareAutomation: vi.fn().mockResolvedValue(prepared),
      enqueuePrepared: vi.fn().mockResolvedValue('queued'),
    };
    const scan = new RenewalRemindersService(repo as unknown as EmailRepository, email as unknown as EmailService);
    expect(await scan.run(new Date('2026-11-07T00:00:00Z'))).toBe(1);
    expect(email.prepareAutomation).toHaveBeenCalledTimes(1);
    expect(repo.findExistingIdempotencyKeys).toHaveBeenCalledWith([
      'renewal_due_soon:due:2026-12-07',
      'renewal_due_soon:queued-already:2026-12-06',
    ]);
    expect(email.enqueuePrepared).toHaveBeenCalledExactlyOnceWith(
      prepared,
      expect.objectContaining({ id: 'due' }),
      'due@work.example',
      {
        idempotencyKey: 'renewal_due_soon:due:2026-12-07',
        variables: { RENEWAL_DATE: '7 Dec 2026' },
      }
    );
  });
  it('does not scan when disabled', async () => {
    const repo = { renewalCandidates: vi.fn() };
    const email = { prepareAutomation: vi.fn().mockResolvedValue(null) };
    expect(
      await new RenewalRemindersService(repo as unknown as EmailRepository, email as unknown as EmailService).run()
    ).toBe(0);
    expect(repo.renewalCandidates).not.toHaveBeenCalled();
  });
});
