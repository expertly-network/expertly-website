import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { Logger } from '@nestjs/common';

const logger = new Logger('fetchSafe');

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

// Blocks loopback, link-local (incl. the cloud metadata address 169.254.169.254), and RFC1918
// private ranges. Not a full IP-range library — a member-pasted URL only ever needs to be
// rejected for being "not a public web page," so a conservative allow-only-public-looking-IPs
// check is enough; false positives (rejecting a legitimate public IP) are the safe failure mode
// here, not false negatives.
function isBlockedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
    if (a === 192 && b === 168) return true; // RFC1918
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 0) return true;
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true; // loopback
    if (lower.startsWith('fe80:')) return true; // link-local
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local (fc00::/7)
    return false;
  }
  return true; // couldn't parse — refuse rather than guess
}

async function assertPublicHost(hostname: string): Promise<void> {
  let addresses: { address: string }[];
  try {
    addresses = [await lookup(hostname)];
  } catch {
    throw new Error('Could not resolve host.');
  }
  if (addresses.some((a) => isBlockedIp(a.address))) {
    throw new Error('Refusing to fetch a private/internal address.');
  }
}

/**
 * Fetches a member-pasted URL server-side for the AI wizard's "sources & style" step, with SSRF
 * guards: http(s)-only, DNS-resolved IP re-checked against private/loopback/link-local ranges
 * before *and after* every redirect hop (a same-origin-looking URL can still redirect into a
 * blocked range), an 8s timeout, and a 3MB response cap. Returns null (never throws) on any
 * failure — the caller skips that one link and tells the member it couldn't be read, rather than
 * failing the whole generate call over one bad link.
 */
export async function fetchSafeText(rawUrl: string): Promise<string | null> {
  try {
    let target = new URL(rawUrl);
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (target.protocol !== 'http:' && target.protocol !== 'https:') {
        throw new Error('Only http(s) URLs are allowed.');
      }
      await assertPublicHost(target.hostname);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(target, { redirect: 'manual', signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      if ([301, 302, 303, 307, 308].includes(res.status)) {
        const location = res.headers.get('location');
        if (!location) throw new Error('Redirect with no Location header.');
        target = new URL(location, target);
        continue;
      }

      if (!res.ok) throw new Error(`Fetch failed with status ${res.status}.`);

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
        throw new Error(`Unsupported content-type: ${contentType}.`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body.');
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          throw new Error('Response too large.');
        }
        chunks.push(value);
      }
      return Buffer.concat(chunks).toString('utf-8');
    }
    throw new Error('Too many redirects.');
  } catch (error) {
    logger.warn(`Skipping unfetchable source link: ${error instanceof Error ? error.message : error}`);
    return null;
  }
}
