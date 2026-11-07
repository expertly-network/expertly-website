import { EmailSendError, type EmailProvider, type OutgoingEmail } from './email-provider';
export class ResendProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}
  async send(m: OutgoingEmail): Promise<{ providerMessageId: string }> {
    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': m.idempotencyKey,
        },
        // Subject and body come from the published template; from/reply_to override its defaults
        // so each environment sends from its own address.
        body: JSON.stringify({
          from: m.from,
          to: [m.to],
          reply_to: m.replyTo,
          template: { id: m.template.id, variables: m.template.variables },
        }),
      });
    } catch {
      throw new EmailSendError('Resend request failed or timed out', true);
    }
    // Do not retain provider response text: it may echo recipient/content data.
    // 404/422 usually mean the template alias isn't published or a declared variable is missing:
    // final, fix the template in Resend then retry the message.
    if (!response.ok)
      throw new EmailSendError(`Resend HTTP ${response.status}`, response.status === 429 || response.status >= 500);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new EmailSendError('Invalid Resend response', true);
    }
    if (!body || typeof body !== 'object' || !('id' in body) || typeof body.id !== 'string')
      throw new EmailSendError('Missing Resend message ID', true);
    return { providerMessageId: body.id };
  }
}
