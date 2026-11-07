import { Injectable, Logger } from '@nestjs/common';
import { EmailRepository } from './email.repository';
import { EmailService } from './email.service';
import { computeDueState, renewalDueDate } from '../members/renewal';
@Injectable()
export class RenewalRemindersService {
  private readonly logger = new Logger(RenewalRemindersService.name);
  constructor(
    private readonly repo: EmailRepository,
    private readonly email: EmailService
  ) {}
  async run(now = new Date(), shouldStop: () => boolean = () => false): Promise<number> {
    // Template, version and layout are resolved once per scan, not once per member.
    const prepared = await this.email.prepareAutomation('renewal_due_soon');
    if (!prepared) return 0;
    let queued = 0,
      afterId: string | undefined;
    while (!shouldStop()) {
      const members = await this.repo.renewalCandidates(afterId);
      if (!members.length) break;
      afterId = members[members.length - 1].id;
      const due = members
        .filter((m) => computeDueState(m.membership_started_at, now) === 'due-soon')
        .map((m) => {
          const date = renewalDueDate(m.membership_started_at);
          return { id: m.id, date, key: `renewal_due_soon:${m.id}:${date.toISOString().slice(0, 10)}` };
        });
      // A member sits in the 30-day window for ~720 hourly scans; skip the ones already queued
      // this cycle in one query instead of re-rendering and re-inserting each of them.
      const existing = await this.repo.findExistingIdempotencyKeys(due.map((d) => d.key));
      const pending = due.filter((d) => !existing.has(d.key));
      const profiles = new Map((await this.repo.findProfiles(pending.map((d) => d.id))).map((p) => [p.id, p]));
      for (const d of pending) {
        if (shouldStop()) return queued;
        const profile = profiles.get(d.id);
        if (!profile) continue;
        try {
          const result = await this.email.enqueuePrepared(prepared, profile, {
            idempotencyKey: d.key,
            variables: {
              RENEWAL_DATE: d.date.toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                timeZone: 'UTC',
              }),
            },
          });
          if (result === 'queued') queued++;
        } catch {
          this.logger.error(`Renewal reminder enqueue failed for member ${d.id}`);
        }
      }
    }
    return queued;
  }
}
