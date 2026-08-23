import { createClient } from '@/lib/supabase/client';
import { mapAuthError } from '@/lib/auth/errors';

export type EmailAuthResult =
  | { status: 'signed_in' }
  | { status: 'check_email'; email: string }
  | { status: 'error'; message: string };

/**
 * Explicit sign-in — the User tab's Sign In screen. No fallback to sign-up:
 * a failed sign-in is just a failed sign-in, with a link back to "Become one"
 * for someone who doesn't have an account yet.
 */
export async function signInWithEmail(params: {
  email: string;
  password: string;
}): Promise<EmailAuthResult> {
  const supabase = createClient();

  try {
    const { error } = await supabase.auth.signInWithPassword(params);
    if (error) {
      return { status: 'error', message: mapAuthError(error) };
    }
    return { status: 'signed_in' };
  } catch (err) {
    return { status: 'error', message: mapAuthError(err) };
  }
}

/**
 * Explicit sign-up — the User tab's "Become one" screen. `city` is optional
 * and, like `firstName`/`lastName`, stored only as auth user metadata for now
 * (no `profiles.city` column exists yet) — promote it to a real column later
 * if a feature actually needs to query on it.
 */
export async function signUpWithEmail(params: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  city?: string;
}): Promise<EmailAuthResult> {
  const { firstName, lastName, email, password, city } = params;
  const supabase = createClient();

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
          ...(city ? { city } : {}),
        },
      },
    });

    if (error) {
      return { status: 'error', message: mapAuthError(error) };
    }

    if (data.session) {
      // Autoconfirm is on for this project — signed in immediately.
      return { status: 'signed_in' };
    }

    if (data.user && data.user.identities?.length === 0) {
      // Supabase's documented signal for "this email is already registered and
      // confirmed" — no error is thrown, to avoid leaking existence via error text.
      return {
        status: 'error',
        message:
          "An account already exists for this email. Try signing in instead, or use 'Forgot password' — or sign in with LinkedIn if that's how you originally joined.",
      };
    }

    return { status: 'check_email', email };
  } catch (err) {
    return { status: 'error', message: mapAuthError(err) };
  }
}
