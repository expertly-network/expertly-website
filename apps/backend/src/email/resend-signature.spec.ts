import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyResendSignature } from './resend-signature';
const secret = `whsec_${Buffer.from('test-webhook-secret').toString('base64')}`;
const payload = '{"hello":"world"}',
  timestamp = '1800000000',
  id = 'event-1';
const signature =
  'v1,' +
  createHmac('sha256', Buffer.from('test-webhook-secret')).update(`${id}.${timestamp}.${payload}`).digest('base64');
const input = { secret, payload, timestamp, id, signature, now: Number(timestamp) * 1000 };
describe('Resend signature', () => {
  it('accepts a valid signature including rotation', () => {
    expect(verifyResendSignature(input)).toBe(true);
    expect(verifyResendSignature({ ...input, signature: `v1,invalid ${signature}` })).toBe(true);
  });
  it('rejects tampering, stale/future timestamps and malformed inputs', () => {
    for (const change of [
      { payload: payload + ' ' },
      { now: input.now + 301000 },
      { now: input.now - 301000 },
      { secret: 'whsec_!!!' },
      { secret: '' },
      { timestamp: '1e9' },
      { signature: 'v2,invalid' },
      { id: undefined },
    ])
      expect(verifyResendSignature({ ...input, ...change })).toBe(false);
  });
});
