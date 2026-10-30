import { AuthApiError, AuthError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { mapAuthError } from './errors';

const FALLBACK = 'Something went wrong. Please try again.';

describe('mapAuthError', () => {
  it('maps known GoTrue codes to our own copy', () => {
    expect(mapAuthError(new AuthApiError('Invalid login credentials', 400, 'invalid_credentials'))).toBe(
      'Incorrect email or password.'
    );
    expect(mapAuthError(new AuthApiError('Email not confirmed', 400, 'email_not_confirmed'))).toMatch(
      /confirm your email/
    );
  });

  it.each([
    new AuthApiError('User already registered', 422, 'user_already_exists'),
    new AuthApiError('A user with this email address has already been registered', 422, 'email_exists'),
    new AuthApiError('Database error querying schema', 500, 'unexpected_failure'),
    new AuthApiError('Something internal', 500, undefined),
  ])('never surfaces the raw GoTrue message ($message)', (error) => {
    const message = mapAuthError(error);
    expect(message).toBe(FALLBACK);
    expect(message).not.toContain(error.message);
  });

  it('reports a network failure as such', () => {
    expect(mapAuthError(new TypeError('Failed to fetch'))).toBe(
      "Couldn't reach the server. Check your connection and try again."
    );
  });

  it.each([null, undefined, 'string', new Error('x'), new AuthError('client-side auth error')])(
    'falls back for %s',
    (error) => {
      expect(mapAuthError(error)).toBe(FALLBACK);
    }
  );
});
