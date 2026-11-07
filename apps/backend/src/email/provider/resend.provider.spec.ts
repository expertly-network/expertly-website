import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResendProvider } from './resend.provider';
const message = {
  from: 'hello@example.com',
  to: 'person@example.com',
  replyTo: 'reply@example.com',
  template: { id: 'founding-seat-held', variables: { NAME: 'Alex', SITE_URL: 'https://example.com' } },
  idempotencyKey: 'key-1',
};
afterEach(() => vi.unstubAllGlobals());
describe('Resend provider', () => {
  it('sends the template and its variables with an idempotency key', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'provider-id' }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await expect(new ResendProvider('secret').send(message)).resolves.toEqual({ providerMessageId: 'provider-id' });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'key-1' }),
        body: JSON.stringify({
          from: message.from,
          to: [message.to],
          reply_to: message.replyTo,
          template: message.template,
        }),
      })
    );
  });
  it.each([
    [429, true],
    [500, true],
    [422, false],
    [401, false],
  ])('classifies HTTP %s', async (status, retryable) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('private provider text', { status: status as number }))
    );
    await expect(new ResendProvider('secret').send(message)).rejects.toMatchObject({
      retryable,
      message: `Resend HTTP ${status}`,
    });
  });
  it('retries network failures without exposing content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private data')));
    await expect(new ResendProvider('secret').send(message)).rejects.toMatchObject({
      retryable: true,
      message: 'Resend request failed or timed out',
    });
  });
});
