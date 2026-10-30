import { isAuthApiError, type AuthError } from '@supabase/supabase-js';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please confirm your email address — check your inbox for a link from GrowXQ.',
  user_banned: 'This account has been suspended. Contact contact@growxq.com.',
  weak_password: 'Choose a stronger password (at least 8 characters, with a mix of letters and numbers).',
  over_email_send_rate_limit: 'Too many attempts — please wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts — please wait a few minutes and try again.',
  bad_code_verifier: 'Your sign-in link expired or was already used. Please try again.',
  provider_disabled: "LinkedIn sign-in isn't available right now. Please try again later.",
  oauth_provider_not_supported: "LinkedIn sign-in isn't available right now. Please try again later.",
  same_password: 'Your new password must be different from your current one.',
  otp_expired: 'This link has expired. Please request a new one.',
  flow_state_expired: 'Your sign-in link expired or was already used. Please try again.',
  session_not_found: 'Your session has expired. Please sign in again.',
  session_expired: 'Your session has expired. Please sign in again.',
  reauthentication_needed: 'For your security, please sign in again before changing your password.',
  email_address_invalid: 'Enter a valid email address.',
  signup_disabled: "Sign-ups aren't open right now. Please try again later.",
  identity_already_exists: 'This LinkedIn account is already connected to another GrowXQ account.',
};

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

export function mapAuthError(error: unknown): string {
  if (error === null || error === undefined) return FALLBACK_MESSAGE;

  if (isAuthApiError(error)) {
    const code = (error as AuthError).code;
    if (code && MESSAGES[code]) return MESSAGES[code];
    // Never surface GoTrue's raw message: it can confirm whether an account exists and isn't
    // written for end users.
    return FALLBACK_MESSAGE;
  }

  if (error instanceof TypeError) return NETWORK_MESSAGE;

  return FALLBACK_MESSAGE;
}
