// session-token.spec.ts
import { describe, expect, it } from 'vitest';
import { hashSessionToken, newSessionToken } from './session-token';

describe('session tokens', () => {
  it('are random, url-safe and 43 chars', () => {
    const a = newSessionToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newSessionToken()).not.toBe(a);
  });
  it('hash deterministically to hex sha-256', () => {
    expect(hashSessionToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
