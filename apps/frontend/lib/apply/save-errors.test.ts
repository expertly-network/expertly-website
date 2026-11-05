import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { EMAIL_PATTERN, LINKEDIN_PROFILE_URL_PATTERN, validationFieldsMessage } from './save-errors';

const validationError = (...messages: string[]) =>
  new ApiError(messages.join(' '), 400, 'VALIDATION_FAILED', undefined, messages);

describe('validationFieldsMessage', () => {
  it('names each rejected field once, in a readable form', () => {
    expect(
      validationFieldsMessage(
        validationError(
          'contactEmail must be an email',
          'peerReferences.0.email must be an email',
          'city must be shorter'
        )
      )
    ).toBe('Please check: Contact email, Reference 1, Location.');
  });

  it('returns null for unknown fields and other error codes', () => {
    expect(validationFieldsMessage(validationError('property foo should not exist'))).toBeNull();
    expect(validationFieldsMessage(new ApiError('x', 400, 'RATE_RANGE_INVALID'))).toBeNull();
  });
});

describe('patterns', () => {
  it('rejects the emails the backend rejects', () => {
    expect(EMAIL_PATTERN.test('name@gmail.com')).toBe(true);
    expect(EMAIL_PATTERN.test('name@gmail')).toBe(false);
    expect(EMAIL_PATTERN.test('name @gmail.com')).toBe(false);
  });

  it('accepts LinkedIn profile URLs only', () => {
    expect(LINKEDIN_PROFILE_URL_PATTERN.test('https://www.linkedin.com/in/shreyans-maloo/')).toBe(true);
    expect(LINKEDIN_PROFILE_URL_PATTERN.test('linkedin.com/in/jane')).toBe(true);
    expect(LINKEDIN_PROFILE_URL_PATTERN.test('https://www.linkedin.com/in/shreyans maloo')).toBe(false);
    expect(LINKEDIN_PROFILE_URL_PATTERN.test('https://example.com/jane')).toBe(false);
  });
});
