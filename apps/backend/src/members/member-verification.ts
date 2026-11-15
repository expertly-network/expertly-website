import type { MemberEditSection } from '@shared/member';
import type { SectionItem } from './member-sections';

// The rules for what a live self-edit does to verification (docs/rest-api.md "Member profile — live
// edits, verification & recommendation requests"). Pure functions so they are tested without a DB.

/** Keys whose change makes an item "new" for verification; any other edit keeps the tick. */
export const MATERIAL_KEYS: Partial<Record<MemberEditSection, readonly string[]>> = {
  engagements: ['title', 'clientName', 'isConfidential', 'year', 'url'],
  key_clients: ['name'],
  work_experiences: ['title', 'company', 'startMonth', 'startYear', 'endMonth', 'endYear', 'isCurrent'],
  education: ['degree', 'institution', 'field', 'endYear'],
  testimonials: ['quote', 'clientName', 'clientTitle', 'clientCompany'],
  awards: ['title', 'issuingBody', 'year'],
};

/** Contact is a block of columns: any change to one of these resets `contact_verified`. */
export const CONTACT_FIELDS = ['workEmail', 'contactPhone', 'linkedinUrl', 'website'] as const;

// null, undefined and blank strings are the same "empty"; text is compared trimmed.
function canonical(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value.trim() === '' ? null : value.trim();
  return value;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

function sameKeys(a: SectionItem, b: SectionItem, keys: readonly string[]): boolean {
  return keys.every((key) => sameValue(a[key], b[key]));
}

/** True when `submitted` changes a key field of the `live` item (so verification must reset). */
export function isMaterialChange(section: MemberEditSection, live: SectionItem, submitted: SectionItem): boolean {
  const keys = MATERIAL_KEYS[section] ?? [];
  return !sameKeys(live, submitted, keys);
}

/**
 * Sets `isVerified` on every submitted item, plus two server-owned dates the admin screen reads:
 * `changedAt` (when the item was added or a key field last changed) and `verifiedAt` (when an admin
 * last verified it — kept through a later edit, so "verified once, changed since" is visible). A new
 * item (no id, or an id the live section doesn't have) is unverified; an existing one keeps its live
 * flag unless a key field changed. None of these are ever trusted from the payload.
 */
export function applyVerificationRules(
  section: MemberEditSection,
  live: SectionItem[],
  submitted: SectionItem[],
  now: Date = new Date()
): SectionItem[] {
  const liveById = new Map(live.map((item) => [item.id as string, item]));
  return submitted.map((item) => {
    const { isVerified: _ignored, changedAt: _c, verifiedAt: _v, ...rest } = item;
    const match = typeof item.id === 'string' ? liveById.get(item.id) : undefined;
    if (!match) return { ...rest, isVerified: false, changedAt: now.toISOString() };
    const changed = isMaterialChange(section, match, item);
    const keepsTick = match.isVerified === true && !changed;
    const out: SectionItem = {
      ...rest,
      isVerified: keepsTick,
      changedAt: changed ? now.toISOString() : (match.changedAt ?? null),
    };
    if (match.verifiedAt) out.verifiedAt = match.verifiedAt;
    return out;
  });
}

/**
 * True when the submitted list equals the live one — same items, same order, nothing different in
 * any stored field (proof included). Such a save must write nothing and reset nothing.
 */
export function isSectionUnchanged(
  section: MemberEditSection,
  fields: readonly string[],
  live: SectionItem[],
  submitted: SectionItem[]
): boolean {
  if (live.length !== submitted.length) return false;
  return submitted.every((item, i) => {
    const match = live[i];
    if (typeof item.id !== 'string' || item.id !== match.id) return false;
    return (
      sameKeys(
        match,
        item,
        fields.filter((f) => f !== 'id' && f !== 'proofAttachments')
      ) &&
      JSON.stringify(canonical(match.proofAttachments ?? [])) === JSON.stringify(canonical(item.proofAttachments ?? []))
    );
  });
}

export function isContactChanged(live: Partial<Record<string, unknown>>, submitted: Partial<Record<string, unknown>>) {
  return !sameKeys(live, submitted, CONTACT_FIELDS);
}
