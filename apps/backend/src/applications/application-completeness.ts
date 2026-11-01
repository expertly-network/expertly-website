import { isEmail } from 'class-validator';

// Submit-time checks for what a draft is allowed to leave unfinished. Draft saves accept blank
// text inside work-experience / education / peer-reference entries and no phone (the wizard saves
// the whole form on every step, Back included, so a half-filled card on a later step must not
// block saving an earlier one); submitting requires all of it. Each returns the
// `missing or invalid` labels for APPLICATION_INCOMPLETE.

// Digits only, so "+44 (0) 7700-900 000" and "7700900000" are judged the same.
const PHONE_MIN_DIGITS = 6;
const PHONE_MAX_DIGITS = 15;

interface EntryRow {
  phone?: string | null;
  work_experiences?: unknown;
  educations?: unknown;
  peer_references?: unknown;
}

function blank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim() === '';
}

function entries(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

// `requirePeerReferences` is false during the founding-cohort pre-launch (SITE_LAUNCHED=false),
// when the wizard doesn't show the references section at all.
export function incompleteEntryFields(row: EntryRow, { requirePeerReferences = true } = {}): string[] {
  const missing: string[] = [];

  const phoneDigits = (row.phone ?? '').replace(/\D/g, '');
  if (phoneDigits.length === 0) missing.push('phone');
  else if (phoneDigits.length < PHONE_MIN_DIGITS || phoneDigits.length > PHONE_MAX_DIGITS) {
    missing.push(`phone (${PHONE_MIN_DIGITS}-${PHONE_MAX_DIGITS} digits)`);
  }

  entries(row.work_experiences).forEach((w, i) => {
    if (blank(w.title)) missing.push(`workExperiences[${i}].title`);
    if (blank(w.company)) missing.push(`workExperiences[${i}].company`);
  });
  entries(row.educations).forEach((e, i) => {
    if (blank(e.institution)) missing.push(`educations[${i}].institution`);
    if (blank(e.degree)) missing.push(`educations[${i}].degree`);
  });
  if (!requirePeerReferences) return missing;
  const peerReferences = entries(row.peer_references);
  if (peerReferences.length !== 2) missing.push('peerReferences (exactly 2 required)');
  peerReferences.forEach((r, i) => {
    if (blank(r.name)) missing.push(`peerReferences[${i}].name`);
    if (blank(r.relationship)) missing.push(`peerReferences[${i}].relationship`);
    if (typeof r.email !== 'string' || !isEmail(r.email.trim())) missing.push(`peerReferences[${i}].email`);
  });

  return missing;
}
