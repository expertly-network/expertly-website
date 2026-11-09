// The app events that can send an email. Each maps (in email_automations) to a published Resend
// template; this file fixes which Resend template variables the event supplies. A template may
// use only these — Resend rejects a send that omits a variable the template declares without a
// fallback value.
export type AutomationKey =
  | 'founding_application_submitted'
  | 'application_submitted'
  | 'renewal_due_soon'
  | 'interview_drafts_ready';
export const AUTOMATION_KEYS: readonly AutomationKey[] = [
  'founding_application_submitted',
  'application_submitted',
  'renewal_due_soon',
  'interview_drafts_ready',
];
// Sent with every email. Resend reserves FIRST_NAME, LAST_NAME and EMAIL, hence NAME.
export const STANDARD_VARIABLES = ['NAME', 'SITE_URL'] as const;
export const AUTOMATION_VARIABLES: Record<AutomationKey, readonly string[]> = {
  founding_application_submitted: STANDARD_VARIABLES,
  application_submitted: STANDARD_VARIABLES,
  renewal_due_soon: [...STANDARD_VARIABLES, 'RENEWAL_DATE'],
  interview_drafts_ready: STANDARD_VARIABLES,
};
export function isAutomationKey(key: string): key is AutomationKey {
  return (AUTOMATION_KEYS as readonly string[]).includes(key);
}
