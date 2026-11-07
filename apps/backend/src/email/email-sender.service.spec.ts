import { describe, expect, it, vi } from 'vitest';
import { EmailSenderService, backoffDelayMs } from './email-sender.service';
import { EmailRepository } from './email.repository';
import { EmailConfig } from './email.config';
import { EmailSendError } from './provider/email-provider';
import { messageFixture } from './test-fixtures';
function setup(redirectTo?: string) {
  const repo = {
    isSuppressed: vi.fn().mockResolvedValue(false),
    updateMessage: vi.fn().mockResolvedValue(true),
  };
  const provider = { send: vi.fn().mockResolvedValue({ providerMessageId: 'resend-id' }) };
  const config = { from: 'sender@example.com', replyTo: 'reply@example.com', redirectTo } as EmailConfig;
  return { repo, provider, sender: new EmailSenderService(repo as unknown as EmailRepository, config, provider) };
}
describe('email sender', () => {
  it('sends the Resend template and records success against the exact claimed lease', async () => {
    const { repo, provider, sender } = setup();
    expect(await sender.sendOne(messageFixture())).toBe('sent');
    expect(provider.send).toHaveBeenCalledWith({
      from: 'sender@example.com',
      replyTo: 'reply@example.com',
      to: 'person@example.com',
      template: { id: 'founding-seat-held', variables: { NAME: 'Alex', SITE_URL: 'https://example.com' } },
      idempotencyKey: 'automation-key',
    });
    expect(repo.updateMessage).toHaveBeenCalledWith(
      'message-1',
      expect.objectContaining({ status: 'sent', provider_message_id: 'resend-id' }),
      'sending',
      '2026-11-07T00:00:01Z'
    );
  });
  it.each([
    [0, 'queued', 1],
    [4, 'failed', 5],
  ])('bounds retry attempts starting at %s', async (attempts, status, next) => {
    const { repo, provider, sender } = setup();
    provider.send.mockRejectedValue(new EmailSendError('rate limited', true));
    await sender.sendOne(messageFixture({ attempts: attempts as number }));
    expect(repo.updateMessage).toHaveBeenCalledWith(
      'message-1',
      expect.objectContaining({ status, attempts: next }),
      'sending',
      expect.any(String)
    );
  });
  it('fails a provider rejection (e.g. an unpublished template) for good', async () => {
    const { repo, provider, sender } = setup();
    provider.send.mockRejectedValue(new EmailSendError('Resend HTTP 422', false));
    expect(await sender.sendOne(messageFixture())).toBe('failed');
    expect(repo.updateMessage.mock.calls[0][1]).toMatchObject({ status: 'failed', last_error: 'Resend HTTP 422' });
  });
  it('suppresses addresses before contacting the provider', async () => {
    const { repo, provider, sender } = setup();
    repo.isSuppressed.mockResolvedValue(true);
    await sender.sendOne(messageFixture());
    expect(provider.send).not.toHaveBeenCalled();
    expect(repo.updateMessage.mock.calls[0][1].status).toBe('suppressed');
  });
  it('redirects development mail to the configured address', async () => {
    const { provider, sender } = setup('dev@example.com');
    await sender.sendOne(messageFixture());
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'dev@example.com' }));
  });
  it('leaves an accepted send leased if recording its success fails', async () => {
    const { repo, sender } = setup();
    repo.updateMessage.mockRejectedValue(new Error('database unavailable'));
    await expect(sender.sendOne(messageFixture())).rejects.toThrow('database unavailable');
    expect(repo.updateMessage).toHaveBeenCalledTimes(1);
    expect(repo.updateMessage.mock.calls[0][1].status).toBe('sent');
  });
  it('retries an unexpected error instead of failing the message for good', async () => {
    const { repo, provider, sender } = setup();
    provider.send.mockRejectedValueOnce(new Error('socket hang up'));
    expect(await sender.sendOne(messageFixture())).toBe('retried');
    expect(repo.updateMessage.mock.calls[0][1]).toMatchObject({ status: 'queued', attempts: 1, claim_count: 0 });
  });
  it('sends an admin retry under a fresh provider idempotency key', async () => {
    const { provider, sender } = setup();
    await sender.sendOne(messageFixture({ manual_retries: 2 }));
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'automation-key:retry-2' }));
  });
  it('uses the documented backoff sequence', () =>
    expect([1, 2, 3, 4].map(backoffDelayMs)).toEqual([60000, 300000, 1800000, 7200000]));
});
