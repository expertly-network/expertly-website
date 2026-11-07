// Email engine (apps/backend/src/email/, docs/rest-api.md "Email engine"). Email content lives in
// Resend as published templates; the API exposes only automations (which template each app event
// sends) and the delivery history.
export type EmailMessageStatus =
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'failed'
  | 'cancelled'
  | 'suppressed';
export interface EmailAutomationDto {
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  /** The id or alias of the published Resend template this event sends. */
  resendTemplate: string;
  /** The Resend template variables this event supplies, e.g. ['NAME', 'SITE_URL']. */
  variables: string[];
  updatedAt: string;
}
export interface UpdateEmailAutomationRequest {
  enabled?: boolean;
  resendTemplate?: string;
}
export interface EmailMessageDto {
  id: string;
  automationKey: string;
  resendTemplate: string;
  recipientProfileId: string | null;
  toEmail: string;
  status: EmailMessageStatus;
  nextAttemptAt: string;
  attempts: number;
  providerMessageId: string | null;
  lastError: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}
export interface EmailMessageListResponse {
  items: EmailMessageDto[];
  total: number;
}
