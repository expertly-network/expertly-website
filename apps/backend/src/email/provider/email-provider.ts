export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
export interface OutgoingEmail {
  from: string;
  to: string;
  replyTo?: string;
  /** The id or alias of a published Resend template, and its variables. */
  template: { id: string; variables: Record<string, string> };
  idempotencyKey: string;
}
export interface EmailProvider {
  send(message: OutgoingEmail): Promise<{ providerMessageId: string }>;
}
export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean
  ) {
    super(message);
  }
}
