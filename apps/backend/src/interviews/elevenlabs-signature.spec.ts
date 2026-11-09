// elevenlabs-signature.spec.ts
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyElevenLabsSignature } from './elevenlabs-signature';

const SECRET = 'wsec_test';
const BODY = '{"type":"post_call_transcription"}';
const NOW = 1_800_000_000_000;
function sign(t: number, body = BODY, secret = SECRET): string {
  return `t=${t},v0=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
}

describe('verifyElevenLabsSignature', () => {
  it('accepts a valid signature', () => {
    expect(verifyElevenLabsSignature({ secret: SECRET, header: sign(NOW / 1000), payload: BODY, now: NOW })).toBe(true);
  });
  it('rejects a tampered body', () => {
    expect(verifyElevenLabsSignature({ secret: SECRET, header: sign(NOW / 1000), payload: BODY + ' ', now: NOW })).toBe(
      false
    );
  });
  it('rejects the wrong secret', () => {
    expect(
      verifyElevenLabsSignature({ secret: SECRET, header: sign(NOW / 1000, BODY, 'other'), payload: BODY, now: NOW })
    ).toBe(false);
  });
  it('rejects a stale timestamp (> 30 min)', () => {
    expect(
      verifyElevenLabsSignature({ secret: SECRET, header: sign(NOW / 1000 - 31 * 60), payload: BODY, now: NOW })
    ).toBe(false);
  });
  it.each([undefined, '', 't=abc,v0=00', 'v0=00', 't=1'])('rejects malformed header %s', (header) => {
    expect(verifyElevenLabsSignature({ secret: SECRET, header, payload: BODY, now: NOW })).toBe(false);
  });
});
