// URL constants for the 4 consent PDF links (app/consent/[slug] — a pure redirect to a signed
// Storage URL). Separate from lib/legal.ts, which still serves its own unrelated hardcoded
// placeholder page (/legal/membership-policy) — these two systems are intentionally independent.
// The combined User & Member Policy (slug kept as 'user-agreement' so stored consent versions and
// links stay valid).
export const USER_AGREEMENT_URL = '/consent/user-agreement';
export const PRIVACY_POLICY_URL = '/consent/privacy-policy';
export const COOKIE_POLICY_URL = '/consent/cookie-policy';
export const IMPORT_CONSENT_POLICY_URL = '/consent/import-consent-policy';
