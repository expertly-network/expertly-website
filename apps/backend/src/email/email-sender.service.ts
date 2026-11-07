import { setTimeout as sleep } from 'node:timers/promises';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EmailRepository, type MessageRow } from './email.repository';
import { EmailConfig } from './email.config';
import { EMAIL_PROVIDER, EmailSendError, type EmailProvider } from './provider/email-provider';
import { stringVariables } from './email-variables';
import type { TablesUpdate } from '../supabase/database.types';
export const MAX_ATTEMPTS = 5;
// Automatic retries reuse the key, so a timed-out send the provider did accept is not duplicated;
// each admin retry gets a fresh one, so the provider doesn't answer it with the earlier attempt.
export function providerIdempotencyKey(m: Pick<MessageRow, 'id' | 'idempotency_key' | 'manual_retries'>): string {
  const base = m.idempotency_key ?? m.id;
  return m.manual_retries ? `${base}:retry-${m.manual_retries}` : base;
}
export function backoffDelayMs(attempt: number): number {
  return [60_000, 300_000, 1_800_000, 7_200_000][Math.min(Math.max(attempt - 1, 0), 3)];
}
@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);
  constructor(
    private readonly repo: EmailRepository,
    private readonly config: EmailConfig,
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider
  ) {}
  async run(shouldStop: () => boolean): Promise<{ sent: number; failed: number; retried: number }> {
    const counts = { sent: 0, failed: 0, retried: 0 };
    // Claim at most two at a time: a slow provider cannot exhaust the lease of a large batch.
    for (let processed = 0; processed < 50 && !shouldStop(); processed += 2) {
      const messages = await this.repo.claimMessages(2);
      if (!messages.length) break;
      // Space starts by 550ms; concurrent in-flight requests remain capped at two.
      const results = await Promise.all(
        messages.map(async (m, index) => {
          if (index) await sleep(550);
          try {
            return await this.sendOne(m);
          } catch {
            this.logger.error(`Email ${m.id}: persistence failed; lease will recover`);
            return null;
          }
        })
      );
      for (const result of results) if (result) counts[result]++;
      if (!shouldStop()) await sleep(550);
    }
    return counts;
  }
  async sendOne(m: MessageRow): Promise<'sent' | 'failed' | 'retried' | null> {
    const finish = (patch: TablesUpdate<'email_messages'>) =>
      this.repo.updateMessage(m.id, patch, 'sending', m.claimed_at!);
    if (
      (await this.repo.isSuppressed(m.to_email)) ||
      (this.config.redirectTo && (await this.repo.isSuppressed(this.config.redirectTo)))
    ) {
      await finish({ status: 'suppressed', claimed_at: null });
      return null;
    }
    let result: { providerMessageId: string };
    try {
      result = await this.provider.send({
        from: this.config.from,
        replyTo: this.config.replyTo,
        to: this.config.redirectTo ?? m.to_email,
        template: { id: m.resend_template, variables: stringVariables(m.variables) },
        idempotencyKey: providerIdempotencyKey(m),
      });
    } catch (error) {
      // Only a provider rejection is final (e.g. an unpublished template or a missing variable).
      // Anything else — an unexpected throw — is retried like a transient send error.
      const terminal = error instanceof EmailSendError && !error.retryable;
      const attempts = m.attempts + 1,
        retry = !terminal && attempts < MAX_ATTEMPTS;
      const lastError = error instanceof EmailSendError ? error.message : 'Email send failed';
      await finish({
        status: retry ? 'queued' : 'failed',
        attempts,
        claimed_at: null,
        claim_count: 0,
        last_error: lastError,
        next_attempt_at: new Date(Date.now() + backoffDelayMs(attempts)).toISOString(),
      });
      return retry ? 'retried' : 'failed';
    }
    // Persistence errors after provider acceptance must NOT be classified as send failures.
    // Leave the lease intact; reclaim repeats the same request with the same idempotency key.
    await finish({
      status: 'sent',
      provider_message_id: result.providerMessageId,
      sent_at: new Date().toISOString(),
      last_error: null,
      claimed_at: null,
    });
    return 'sent';
  }
}
