import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { apiErrorMessage } from './api-error-message';

const FALLBACK = 'Could not save. Please try again.';

describe('apiErrorMessage', () => {
  it('prefers call-site copy for a specific code', () => {
    const err = new ApiError('Already pending.', 409, 'CONSULTATION_PENDING_EXISTS');
    expect(apiErrorMessage(err, FALLBACK, { CONSULTATION_PENDING_EXISTS: 'You already asked.' })).toBe(
      'You already asked.'
    );
  });

  it('shows the backend message for other 4xx', () => {
    expect(apiErrorMessage(new ApiError('Title is too long.', 400, 'VALIDATION_FAILED'), FALLBACK)).toBe(
      'Title is too long.'
    );
  });

  it.each([
    ['SESSION_MISSING', 401, 'Your session has expired. Please sign in again.'],
    ['SESSION_INVALID', 401, 'Your session has expired. Please sign in again.'],
    ['ACCOUNT_SUSPENDED', 403, 'Your account is suspended. Contact GrowXQ support if you think this is a mistake.'],
    ['MEMBER_DEACTIVATED', 403, 'Your member profile is deactivated, so this action isn’t available.'],
  ])('uses shared copy for %s', (code, status, message) => {
    expect(apiErrorMessage(new ApiError('raw', status, code), FALLBACK)).toBe(message);
  });

  it('includes the wait on a 429', () => {
    expect(apiErrorMessage(new ApiError('raw', 429, 'RATE_LIMITED', 42), FALLBACK)).toBe(
      'Too many requests. Please wait 42 seconds and try again.'
    );
    expect(apiErrorMessage(new ApiError('raw', 429, 'RATE_LIMITED'), FALLBACK)).toBe(
      'Too many requests. Please wait a moment and try again.'
    );
  });

  it('never shows a 5xx message', () => {
    expect(apiErrorMessage(new ApiError('relation "profiles" does not exist', 500, 'INTERNAL_ERROR'), FALLBACK)).toBe(
      FALLBACK
    );
    expect(apiErrorMessage(new ApiError('upstream', 503, 'AI_NOT_CONFIGURED'), FALLBACK)).toBe(FALLBACK);
  });

  it('still lets call-site copy name a 5xx code', () => {
    expect(
      apiErrorMessage(new ApiError('x', 503, 'AI_NOT_CONFIGURED'), FALLBACK, { AI_NOT_CONFIGURED: 'AI is off.' })
    ).toBe('AI is off.');
  });

  it('falls back for non-ApiErrors (network failures, thrown strings)', () => {
    expect(apiErrorMessage(new TypeError('Failed to fetch'), FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage('boom', FALLBACK)).toBe(FALLBACK);
    expect(apiErrorMessage(new ApiError('', 400), FALLBACK)).toBe(FALLBACK);
  });
});
