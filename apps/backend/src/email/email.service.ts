import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  EmailAutomationDto,
  EmailMessageDto,
  EmailMessageListResponse,
  UpdateEmailAutomationRequest,
} from '@shared/email';
import { EmailRepository, type AutomationRow, type MessageRow, type ProfileRow } from './email.repository';
import { EmailConfig } from './email.config';
import { AUTOMATION_VARIABLES, isAutomationKey, type AutomationKey } from './automations';
import { standardVariables } from './email-variables';
import type { ListEmailMessagesDto } from './dto/email.dto';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new NotFoundException({ code: 'EMAIL_NOT_FOUND', message: 'Email record not found.' });
  return value;
}
export interface PreparedAutomation {
  key: AutomationKey;
  resendTemplate: string;
}

// Decides when and to whom; the email's subject and body are the published Resend template.
@Injectable()
export class EmailService {
  constructor(
    private readonly repo: EmailRepository,
    private readonly config: EmailConfig
  ) {}

  private automationDto(a: AutomationRow): EmailAutomationDto {
    return {
      key: a.key,
      name: a.name,
      description: a.description,
      enabled: a.enabled,
      resendTemplate: a.resend_template,
      variables: isAutomationKey(a.key) ? [...AUTOMATION_VARIABLES[a.key]] : [],
      updatedAt: a.updated_at,
    };
  }
  async listAutomations(): Promise<EmailAutomationDto[]> {
    return (await this.repo.listAutomations()).map((a) => this.automationDto(a));
  }
  async updateAutomation(adminId: string, key: string, req: UpdateEmailAutomationRequest): Promise<EmailAutomationDto> {
    const a = required(await this.repo.findAutomation(key));
    await this.repo.updateAutomation(key, {
      enabled: req.enabled ?? a.enabled,
      resend_template: req.resendTemplate ?? a.resend_template,
      updated_by: adminId,
    });
    return this.automationDto(required(await this.repo.findAutomation(key)));
  }

  /** The automation's template, once; null when it's switched off. */
  async prepareAutomation(key: AutomationKey): Promise<PreparedAutomation | null> {
    const a = await this.repo.findAutomation(key);
    return a?.enabled ? { key, resendTemplate: a.resend_template } : null;
  }
  async enqueuePrepared(
    prepared: PreparedAutomation,
    profile: ProfileRow,
    opts: { idempotencyKey: string; variables?: Record<string, string> }
  ): Promise<'queued' | 'duplicate'> {
    const extra = opts.variables ?? {};
    // Only the variables this event is declared to supply (automations.ts) — never an ad hoc one.
    const unexpected = Object.keys(extra).filter((name) => !AUTOMATION_VARIABLES[prepared.key].includes(name));
    if (unexpected.length)
      throw new BadRequestException({
        code: 'EMAIL_VARIABLES_INVALID',
        message: `Unexpected variables: ${unexpected.join(', ')}`,
      });
    const inserted = await this.repo.insertMessage({
      automation_key: prepared.key,
      resend_template: prepared.resendTemplate,
      recipient_profile_id: profile.id,
      to_email: profile.email.toLowerCase(),
      variables: { ...extra, ...standardVariables({ firstName: profile.first_name }, this.config.siteUrl) },
      idempotency_key: opts.idempotencyKey,
    });
    return inserted ? 'queued' : 'duplicate';
  }
  async enqueueAutomation(
    key: AutomationKey,
    recipient: { profileId: string },
    opts: { idempotencyKey: string; variables?: Record<string, string> }
  ): Promise<'queued' | 'duplicate' | 'disabled'> {
    const prepared = await this.prepareAutomation(key);
    if (!prepared) return 'disabled';
    const profile = required((await this.repo.findProfiles([recipient.profileId]))[0]);
    return this.enqueuePrepared(prepared, profile, opts);
  }

  private messageDto(m: MessageRow): EmailMessageDto {
    return {
      id: m.id,
      automationKey: m.automation_key,
      resendTemplate: m.resend_template,
      recipientProfileId: m.recipient_profile_id,
      toEmail: m.to_email,
      status: m.status,
      nextAttemptAt: m.next_attempt_at,
      attempts: m.attempts,
      providerMessageId: m.provider_message_id,
      lastError: m.last_error,
      sentAt: m.sent_at,
      deliveredAt: m.delivered_at,
      createdAt: m.created_at,
    };
  }
  async listMessages(filter: ListEmailMessagesDto): Promise<EmailMessageListResponse> {
    const { rows, total } = await this.repo.listMessages(filter);
    return { items: rows.map((m) => this.messageDto(m)), total };
  }
  async getMessage(id: string): Promise<EmailMessageDto> {
    return this.messageDto(required(await this.repo.findMessage(id)));
  }
  async cancelMessage(id: string): Promise<void> {
    if (!(await this.repo.updateMessage(id, { status: 'cancelled' }, 'queued')))
      throw new ConflictException({
        code: 'EMAIL_MESSAGE_NOT_CANCELLABLE',
        message: 'Only queued messages can be cancelled.',
      });
  }
  async retryMessage(id: string): Promise<void> {
    const m = required(await this.repo.findMessage(id));
    if (
      m.status !== 'failed' ||
      !(await this.repo.updateMessage(
        id,
        {
          status: 'queued',
          attempts: 0,
          claim_count: 0,
          // A fresh provider idempotency key (providerIdempotencyKey): re-using the failed attempt's
          // key would get the provider's cached answer, or a 409 if the payload has changed since.
          manual_retries: m.manual_retries + 1,
          next_attempt_at: new Date().toISOString(),
          claimed_at: null,
          last_error: null,
        },
        'failed'
      ))
    )
      throw new ConflictException({
        code: 'EMAIL_MESSAGE_NOT_RETRYABLE',
        message: 'Only failed messages can be retried.',
      });
  }
}
