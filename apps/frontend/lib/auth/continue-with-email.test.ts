// @vitest-environment jsdom
import { AuthApiError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signInWithEmail, signUpWithEmail } from './continue-with-email';

const auth = {
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
};

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth }) }));

const SIGN_UP = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', password: 'Str0ng-password' };

beforeEach(() => {
  auth.signUp.mockReset();
  auth.signInWithPassword.mockReset();
});

describe('signUpWithEmail — no account enumeration', () => {
  it('answers check_email for a brand-new address', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null });
    expect(await signUpWithEmail(SIGN_UP)).toEqual({ status: 'check_email', email: 'ada@example.com' });
  });

  it('answers the same check_email for an existing address (obfuscated user, Confirm email on)', async () => {
    auth.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    expect(await signUpWithEmail(SIGN_UP)).toEqual({ status: 'check_email', email: 'ada@example.com' });
  });

  it.each(['user_already_exists', 'email_exists'])('answers check_email when GoTrue says %s', async (code) => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('exists', 422, code),
    });
    expect(await signUpWithEmail(SIGN_UP)).toEqual({ status: 'check_email', email: 'ada@example.com' });
  });

  it('maps other errors without the raw message', async () => {
    auth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError('Password is known to be weak and easy to guess', 422, 'weak_password'),
    });
    const result = await signUpWithEmail(SIGN_UP);
    expect(result).toMatchObject({ status: 'error' });
    expect(JSON.stringify(result)).not.toContain('easy to guess');
  });

  it('signs in straight away only when Supabase returned a session', async () => {
    auth.signUp.mockResolvedValue({ data: { user: {}, session: { access_token: 't' } }, error: null });
    expect(await signUpWithEmail(SIGN_UP)).toEqual({ status: 'signed_in' });
  });

  it('sends the metadata and an encoded returnTo in the confirmation link', async () => {
    auth.signUp.mockResolvedValue({ data: { user: {}, session: null }, error: null });
    await signUpWithEmail({ ...SIGN_UP, city: 'Pune', returnTo: '/members/jane?tab=x' });
    const [{ options }] = auth.signUp.mock.calls[0] as [{ options: { data: unknown; emailRedirectTo: string } }];
    expect(options.data).toEqual({ first_name: 'Ada', last_name: 'Lovelace', city: 'Pune' });
    expect(options.emailRedirectTo).toBe(
      `${window.location.origin}/auth/callback?intent=user&returnTo=%2Fmembers%2Fjane%3Ftab%3Dx`
    );
  });

  it('reports a network failure', async () => {
    auth.signUp.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await signUpWithEmail(SIGN_UP)).toEqual({
      status: 'error',
      message: "Couldn't reach the server. Check your connection and try again.",
    });
  });
});

describe('signInWithEmail', () => {
  it('signs in', async () => {
    auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
    expect(await signInWithEmail({ email: 'a@b.com', password: 'x' })).toEqual({ status: 'signed_in' });
  });

  it('never falls back to sign-up on a failed sign-in', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'),
    });
    expect(await signInWithEmail({ email: 'a@b.com', password: 'x' })).toEqual({
      status: 'error',
      message: 'Incorrect email or password.',
    });
    expect(auth.signUp).not.toHaveBeenCalled();
  });
});
