import { describe, expect, it, vi } from 'vitest';
import { EmailService } from './email.service';
import { EmailRepository } from './email.repository';
import { EmailConfig } from './email.config';
import { messageFixture } from './test-fixtures';
const automation = (patch = {}) => ({
  key: 'founding_application_submitted',
  name: 'Founding application submitted',
  description: null,
  resend_template: 'founding-seat-held',
  enabled: true,
  updated_at: '2026-11-07T00:00:00Z',
  ...patch,
});
function setup() {
  const repo = {
    findAutomation: vi.fn().mockResolvedValue(automation()),
    listAutomations: vi.fn().mockResolvedValue([automation()]),
    updateAutomation: vi.fn().mockResolvedValue(undefined),
    findProfiles: vi.fn(async (ids: string[]) =>
      ids.includes('profile-1') ? [{ id: 'profile-1', email: 'ALEX@example.com', first_name: 'Alex' }] : []
    ),
    insertMessage: vi.fn().mockResolvedValue(true),
    updateMessage: vi.fn().mockResolvedValue(true),
    findMessage: vi.fn().mockResolvedValue(messageFixture({ status: 'failed', manual_retries: 1 })),
  };
  const service = new EmailService(
    repo as unknown as EmailRepository,
    { siteUrl: 'https://example.com' } as EmailConfig
  );
  return { repo, service };
}
describe('EmailService', () => {
  it('queues an automation against its Resend template with the standard variables', async () => {
    const { repo, service } = setup();
    expect(
      await service.enqueueAutomation(
        'founding_application_submitted',
        { profileId: 'profile-1', workEmail: 'Alex@Work.example' },
        { idempotencyKey: 'k' }
      )
    ).toBe('queued');
    expect(repo.insertMessage).toHaveBeenCalledWith({
      automation_key: 'founding_application_submitted',
      resend_template: 'founding-seat-held',
      recipient_profile_id: 'profile-1',
      to_email: 'alex@work.example',
      variables: { NAME: 'Alex', SITE_URL: 'https://example.com' },
      idempotency_key: 'k',
    });
  });
  it('falls back to a greeting name and reports duplicates and disabled automations', async () => {
    const { repo, service } = setup();
    repo.findProfiles.mockResolvedValue([{ id: 'profile-1', email: 'a@example.com', first_name: '  ' }]);
    repo.insertMessage.mockResolvedValue(false);
    expect(
      await service.enqueueAutomation(
        'founding_application_submitted',
        { profileId: 'profile-1', workEmail: 'Alex@Work.example' },
        { idempotencyKey: 'k' }
      )
    ).toBe('duplicate');
    expect(repo.insertMessage.mock.calls[0][0].variables.NAME).toBe('there');
    repo.findAutomation.mockResolvedValue(automation({ enabled: false }));
    expect(
      await service.enqueueAutomation(
        'founding_application_submitted',
        { profileId: 'profile-1', workEmail: 'Alex@Work.example' },
        { idempotencyKey: 'k' }
      )
    ).toBe('disabled');
  });
  it('sends only to the work email: none means nothing is queued', async () => {
    const { repo, service } = setup();
    for (const workEmail of [null, undefined, '  ']) {
      expect(
        await service.enqueueAutomation(
          'founding_application_submitted',
          { profileId: 'profile-1', workEmail },
          {
            idempotencyKey: 'k',
          }
        )
      ).toBe('no_work_email');
    }
    expect(repo.insertMessage).not.toHaveBeenCalled();
  });
  it('accepts only the variables an automation is declared to supply', async () => {
    const { service } = setup();
    const prepared = { key: 'renewal_due_soon' as const, resendTemplate: 'renewal-due-soon' };
    const profile = { id: 'profile-1', email: 'a@example.com', first_name: 'A' };
    await expect(
      service.enqueuePrepared(prepared, profile, 'a@work.example', {
        idempotencyKey: 'k',
        variables: { RENEWAL_DATE: '7 Dec 2026' },
      })
    ).resolves.toBe('queued');
    await expect(
      service.enqueuePrepared(prepared, profile, 'a@work.example', { idempotencyKey: 'k', variables: { OTHER: 'x' } })
    ).rejects.toMatchObject({ response: { code: 'EMAIL_VARIABLES_INVALID' } });
  });
  it('retargets an automation and lists the variables it supplies', async () => {
    const { repo, service } = setup();
    const dto = await service.updateAutomation('admin-1', 'founding_application_submitted', {
      resendTemplate: 'founding-v2',
    });
    expect(repo.updateAutomation).toHaveBeenCalledWith('founding_application_submitted', {
      enabled: true,
      resend_template: 'founding-v2',
      updated_by: 'admin-1',
    });
    expect(dto.variables).toEqual(['NAME', 'SITE_URL']);
  });
  it('uses status preconditions for cancel and retry, with a fresh key per retry', async () => {
    const { repo, service } = setup();
    await service.retryMessage('message-1');
    expect(repo.updateMessage).toHaveBeenCalledWith(
      'message-1',
      expect.objectContaining({ status: 'queued', attempts: 0, claim_count: 0, manual_retries: 2 }),
      'failed'
    );
    repo.updateMessage.mockResolvedValue(false);
    await expect(service.cancelMessage('message-1')).rejects.toMatchObject({
      response: { code: 'EMAIL_MESSAGE_NOT_CANCELLABLE' },
    });
    await expect(service.retryMessage('message-1')).rejects.toMatchObject({
      response: { code: 'EMAIL_MESSAGE_NOT_RETRYABLE' },
    });
    repo.findMessage.mockResolvedValue(messageFixture({ status: 'sent' }));
    repo.updateMessage.mockResolvedValue(true);
    await expect(service.retryMessage('message-1')).rejects.toMatchObject({
      response: { code: 'EMAIL_MESSAGE_NOT_RETRYABLE' },
    });
  });
});
