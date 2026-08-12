import { isAuthApiError, type AuthError } from '@supabase/supabase-js';

const MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed:
    "Please confirm your email address — check your inbox for a link from Expertly.",
  user_banned: 'This account has been suspended. Contact support@expertly.com.',
  user_already_exists:
    "An account already exists for this email. Try signing in, or use 'Forgot password'.",
  weak_password:
    'Choose a stronger password (at least 8 characters, with a mix of letters and numbers).',
  over_email_send_rate_limit: 'Too many attempts — please wait a few minutes and try again.',
  over_request_rate_limit: 'Too many attempts — please wait a few minutes and try again.',
  bad_code_verifier: 'Your sign-in link expired or was already used. Please try again.',
  provider_disabled: "LinkedIn sign-in isn't available right now. Please try again later.",
  oauth_provider_not_supported: "LinkedIn sign-in isn't available right now. Please try again later.",
};

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';
const NETWORK_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

export function mapAuthError(error: unknown): string {
  if (error === null || error === undefined) return FALLBACK_MESSAGE;

  if (isAuthApiError(error)) {
    const code = (error as AuthError).code;
    if (code && MESSAGES[code]) return MESSAGES[code];
    return error.message || FALLBACK_MESSAGE;
  }

  if (error instanceof TypeError) return NETWORK_MESSAGE;

  return FALLBACK_MESSAGE;
}
