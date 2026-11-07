import { createHmac, timingSafeEqual } from 'node:crypto';
export function verifyResendSignature(input: {
  secret: string;
  id?: string;
  timestamp?: string;
  signature?: string;
  payload: string;
  now?: number;
}): boolean {
  const { secret, id, timestamp, signature, payload, now = Date.now() } = input;
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300)
    return false;
  const encoded = secret.startsWith('whsec_') ? secret.slice(6) : '';
  if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;
  const key = Buffer.from(encoded, 'base64');
  if (!key.length) return false;
  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest();
  return signature.split(' ').some((part) => {
    const [version, value] = part.split(',');
    if (version !== 'v1' || !value) return false;
    const actual = Buffer.from(value, 'base64');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}
