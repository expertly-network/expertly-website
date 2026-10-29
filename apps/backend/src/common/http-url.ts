// Member-supplied links (website, LinkedIn, engagement URLs, proof links, logos) end up as
// `<a href>` / `<img src>` on public profiles and the admin review screen, so anything other than
// http(s) — `javascript:`, `data:`, `vbscript:` … — is stored XSS. Scheme-less input
// ("www.firm.com", which many stored values already are) is read as https.
// Mirrors apps/frontend/lib/members/format.ts `safeExternalHref` — change both together.
export const MAX_URL_LENGTH = 2048;

export function toHttpUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!value || value.length > MAX_URL_LENGTH) return null;

  let url: URL | null = null;
  try {
    url = new URL(value);
  } catch {
    url = null;
  }
  // "www.firm.com:8080/x" parses with protocol "www.firm.com:" — a host, not a scheme.
  if (!url || (!['http:', 'https:'].includes(url.protocol) && url.protocol.includes('.'))) {
    try {
      url = new URL(`https://${value.replace(/^\/+/, '')}`);
    } catch {
      return null;
    }
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!url.hostname.includes('.') || url.username || url.password) return null;
  return url;
}

export function isHttpUrl(value: unknown): value is string {
  return typeof value === 'string' && toHttpUrl(value) !== null;
}
