import { createHmac, timingSafeEqual } from 'node:crypto';

const TOLERANCE_SECONDS = 30 * 60;

/** Verifies `elevenlabs-signature: t=<unix>,v0=<hex sha256 hmac of "t.body">`. */
export function verifyElevenLabsSignature(input: {
  secret: string;
  header?: string;
  payload: string;
  now?: number;
}): boolean {
  const { secret, header, payload, now = Date.now() } = input;
  if (!header) return false;
  const parts: Record<string, string> = {};
  for (const part of header.split(',')) {
    const i = part.indexOf('=');
    if (i > 0) parts[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  const t = parts.t;
  const v0 = parts.v0;
  if (!t || !v0 || !/^\d+$/.test(t) || !/^[0-9a-f]+$/i.test(v0)) return false;
  if (Math.abs(now / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest();
  const actual = Buffer.from(v0, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
