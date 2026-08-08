import { isAuthApiError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { mapAuthError } from '@/lib/auth/errors';

export type ContinueWithEmailResult =
  | { status: 'signed_in' }
  | { status: 'check_email'; email: string }
  | { status: 'error'; message: string };

// Guards against re-issuing the signUp fallback for an identical (email, password)
// pair already attempted this page load — otherwise a few typo'd password attempts
// against an unconfirmed account can trip Supabase's confirmation-email rate limit
// purely from this function's own retries.
const attemptedFallbacks = new Set<string>();

/**
 * Single "Continue" action for the User tab: tries sign-in first, and only on a
 * generic invalid-credentials failure (which Supabase deliberately returns for
 * both "wrong password" and "no such account", to prevent user enumeration) falls
 * back to sign-up. This is what makes login vs. sign-up automatic — no manual
 * toggle — matching the design.
 *
 * A pre-provisioned member (no password) hitting this also gets invalid_credentials
 * and falls into the same fallback path — it safely resolves to the
 * "already exists" branch via Supabase's identities:[] signal below, never creating
 * a duplicate account. No special-casing needed.
 */
export async function continueWithEmail(params: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<ContinueWithEmailResult> {
  const { email, password, firstName, lastName } = params;
  const supabase = createClient();

  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (!signInError) {
      return { status: 'signed_in' };
    }

    if (isAuthApiError(signInError) && signInError.code === 'email_not_confirmed') {
      return { status: 'error', message: mapAuthError(signInError) };
    }
    if (isAuthApiError(signInError) && signInError.code === 'user_banned') {
      return { status: 'error', message: mapAuthError(signInError) };
    }
    if (!(isAuthApiError(signInError) && signInError.code === 'invalid_credentials')) {
      // Rate limits, network errors from signInWithPassword itself, etc. — surface
      // directly, don't fall through to a signUp attempt that's unlikely to help.
      return { status: 'error', message: mapAuthError(signInError) };
    }

    const fallbackKey = `${email}:${password}`;
    if (attemptedFallbacks.has(fallbackKey)) {
      return {
        status: 'error',
        message: "Incorrect email or password, or check 'Forgot password' if you already have an account.",
      };
    }
    attemptedFallbacks.add(fallbackKey);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { first_name: firstName, last_name: lastName } },
    });

    if (signUpError) {
      return { status: 'error', message: mapAuthError(signUpError) };
    }

    if (signUpData.session) {
      // Autoconfirm is on for this project — signed in immediately.
      return { status: 'signed_in' };
    }

    if (signUpData.user && signUpData.user.identities?.length === 0) {
      // Supabase's documented signal for "this email is already registered and
      // confirmed" — no error is thrown to avoid leaking existence via error text.
      return {
        status: 'error',
        message:
          "An account already exists for this email. Check your password, or use 'Forgot password' — or sign in with LinkedIn if that's how you originally joined.",
      };
    }

    // Genuinely new signup, or a resend to an existing-but-unconfirmed account —
    // intentionally shown identically (the anti-enumeration-safe choice).
    return { status: 'check_email', email };
  } catch (err) {
    return { status: 'error', message: mapAuthError(err) };
  }
}
