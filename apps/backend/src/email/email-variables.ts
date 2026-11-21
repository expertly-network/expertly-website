// Resend template variables for one recipient. SITE_URL is this environment's public site (the
// backend's SITE_URL), so a template's image and link paths resolve per environment.
export function standardVariables(recipient: { firstName?: string | null }, siteUrl: string): Record<string, string> {
  // first_name sometimes holds a full name (bad signup/import data) — only the first token goes
  // into the greeting, regardless of what's stored.
  return { NAME: recipient.firstName?.trim().split(/\s+/)[0] || 'there', SITE_URL: siteUrl };
}
// A stored variables JSON back to a string map; anything that isn't a string value is dropped.
export function stringVariables(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}
