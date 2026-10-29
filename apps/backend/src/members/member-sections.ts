import { BadRequestException } from '@nestjs/common';
import type { EngagementVerificationMethod, MemberEditSection } from '@shared/member';
import { assertValidWorkHistory, sortWorkHistoryNewestFirst, type WorkSpan } from '../common/work-history';
import { isHttpUrl } from '../common/http-url';

export type SectionItem = Record<string, unknown>;

// Array-shaped sections whose items carry their own proofAttachments (as opposed to
// education/work_experiences, which share one edit-level proof for the whole batch).
export const PER_ITEM_PROOF_SECTIONS: readonly MemberEditSection[] = ['engagements', 'testimonials', 'awards', 'key_clients'];

export const ARRAY_SECTIONS: readonly MemberEditSection[] = [
  'engagements',
  'education',
  'work_experiences',
  'key_clients',
  'testimonials',
  'awards',
];

export const MAX_KEY_CLIENTS = 20;
// Bounds for every array section, so one edit's payload (and the files it references) stays small.
const MAX_SECTION_ITEMS = 50;
const MAX_PROOF_ATTACHMENTS_PER_ITEM = 10;
const MAX_VERIFICATION_OTHER_LENGTH = 300;

const VERIFICATION_METHODS: readonly EngagementVerificationMethod[] = [
  'engagement_letter',
  'client_deliverable',
  'mail_confirmation_pdf',
  'newsletter_transaction_update',
  'other',
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function badRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

export function isArraySection(section: string): boolean {
  return (ARRAY_SECTIONS as readonly string[]).includes(section);
}

export function hasItemProof(item: SectionItem): boolean {
  return Array.isArray(item.proofAttachments) && item.proofAttachments.length > 0;
}

// Shapes a stored (live) item for output: fills defaults for fields added after older rows were
// written, always emits a boolean isVerified, and strips private proof unless the viewer is
// allowed to see it (the owning member, or an admin).
export function normalizeLiveItem(section: MemberEditSection, item: SectionItem, includeProof: boolean): SectionItem {
  const out: SectionItem = { ...item, isVerified: item.isVerified === true };
  if (section === 'work_experiences') {
    out.startMonth = item.startMonth ?? null;
    out.endMonth = item.endMonth ?? null;
  }
  if (section === 'engagements') {
    out.clientName = item.clientName ?? null;
    out.verificationMethods = Array.isArray(item.verificationMethods) ? item.verificationMethods : [];
    out.verificationMethodOther = item.verificationMethodOther ?? null;
  }
  // A client's email exists only so the GrowXQ team can randomly verify the relationship — it's
  // a third party's address, so like proof it's visible to the owning member and admins only.
  if (section === 'engagements' || section === 'testimonials') {
    if (includeProof) out.clientEmail = item.clientEmail ?? null;
    else delete out.clientEmail;
  }
  if ((PER_ITEM_PROOF_SECTIONS as readonly string[]).includes(section)) {
    if (includeProof) out.proofAttachments = Array.isArray(item.proofAttachments) ? item.proofAttachments : [];
    else delete out.proofAttachments;
  }
  return out;
}

export function normalizeLiveSection(section: MemberEditSection, items: unknown, includeProof: boolean): SectionItem[] {
  const list = Array.isArray(items) ? (items as SectionItem[]) : [];
  const normalized = list.map((item) => normalizeLiveItem(section, item, includeProof));
  return section === 'work_experiences'
    ? sortWorkHistoryNewestFirst(normalized as unknown as (WorkSpan & SectionItem)[])
    : normalized;
}

function validateProofAttachments(section: string, value: unknown): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    throw badRequest('PROOF_ATTACHMENTS_INVALID', `${section} item proofAttachments must be an array.`);
  }
  if (value.length > MAX_PROOF_ATTACHMENTS_PER_ITEM) {
    throw badRequest(
      'PROOF_ATTACHMENTS_INVALID',
      `${section} items can have at most ${MAX_PROOF_ATTACHMENTS_PER_ITEM} proof attachments.`
    );
  }
  for (const attachment of value as { type?: unknown; url?: unknown; label?: unknown }[]) {
    const validType = attachment.type === 'file' || attachment.type === 'link';
    const validUrl = typeof attachment.url === 'string' && attachment.url.trim().length > 0;
    const validLabel = typeof attachment.label === 'string' && attachment.label.trim().length > 0;
    if (!validType || !validUrl || !validLabel) {
      throw badRequest(
        'PROOF_ATTACHMENTS_INVALID',
        `${section} item proofAttachments entries require type ('file'|'link'), url, and label.`
      );
    }
    if (attachment.type === 'link' && !isHttpUrl(attachment.url)) {
      throw badRequest('URL_INVALID', `${section} proof links must be http(s) web addresses.`);
    }
  }
}

// Optional URL field on an item or payload: absent/empty is fine, anything else must be http(s).
function assertOptionalHttpUrl(value: unknown, field: string): void {
  if (value == null || value === '') return;
  if (!isHttpUrl(value)) throw badRequest('URL_INVALID', `${field} must be an http(s) web address.`);
}

function validateEngagement(item: SectionItem): void {
  if (typeof item.clientName !== 'string' || item.clientName.trim().length === 0) {
    throw badRequest('ENGAGEMENT_CLIENT_NAME_REQUIRED', 'Each key engagement requires a clientName.');
  }
  assertOptionalHttpUrl(item.url, 'engagements url');
  if (item.clientEmail != null && item.clientEmail !== '' && !isEmail(item.clientEmail)) {
    throw badRequest('ENGAGEMENT_CLIENT_EMAIL_INVALID', 'clientEmail must be a valid email address.');
  }
  if (item.verificationMethods !== undefined) {
    const methods = item.verificationMethods;
    if (
      !Array.isArray(methods) ||
      !methods.every((m) => (VERIFICATION_METHODS as readonly unknown[]).includes(m)) ||
      new Set(methods).size !== methods.length
    ) {
      throw badRequest(
        'ENGAGEMENT_VERIFICATION_METHODS_INVALID',
        `verificationMethods must be a list of unique values from: ${VERIFICATION_METHODS.join(', ')}.`
      );
    }
  }
  const other = item.verificationMethodOther;
  if (other != null && (typeof other !== 'string' || other.length > MAX_VERIFICATION_OTHER_LENGTH)) {
    throw badRequest(
      'ENGAGEMENT_VERIFICATION_METHODS_INVALID',
      `verificationMethodOther must be text up to ${MAX_VERIFICATION_OTHER_LENGTH} characters.`
    );
  }
}

function validateKeyClient(item: SectionItem): void {
  if (typeof item.name !== 'string' || item.name.trim().length === 0) {
    throw badRequest('KEY_CLIENT_NAME_REQUIRED', 'Each key client requires a name.');
  }
  assertOptionalHttpUrl(item.logoUrl, 'key_clients logoUrl');
}

function validateTestimonial(item: SectionItem): void {
  if (item.clientEmail != null && item.clientEmail !== '' && !isEmail(item.clientEmail)) {
    throw badRequest('TESTIMONIAL_CLIENT_EMAIL_INVALID', 'clientEmail must be a valid email address.');
  }
}

function validateContact(payload: unknown): void {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw badRequest('CONTACT_PAYLOAD_INVALID', 'contact payload must be an object.');
  }
  const p = payload as Record<string, unknown>;
  for (const key of ['contactEmail', 'workEmail', 'contactPhone', 'linkedinUrl', 'website']) {
    if (p[key] != null && typeof p[key] !== 'string') {
      throw badRequest('CONTACT_PAYLOAD_INVALID', `contact.${key} must be a string or null.`);
    }
  }
  for (const key of ['contactEmail', 'workEmail']) {
    const value = p[key];
    if (typeof value === 'string' && value.trim() !== '' && !isEmail(value)) {
      throw badRequest('CONTACT_EMAIL_INVALID', `${key} must be a valid email address.`);
    }
  }
  assertOptionalHttpUrl(p.linkedinUrl, 'contact.linkedinUrl');
  assertOptionalHttpUrl(p.website, 'contact.website');
}

// Validates a submitted edit payload per section. Proof is never required here — it is optional
// for members everywhere; it only matters to the admin's decision (see MembersService review).
// Returns the payload to store (work history sorted newest-first).
export function validateAndPrepareEditPayload(section: MemberEditSection, payload: unknown): unknown {
  if (section === 'headline_bio') {
    const p = payload as { headline?: unknown; bio?: unknown };
    if (typeof p?.headline !== 'string' || typeof p?.bio !== 'string') {
      throw badRequest('HEADLINE_BIO_INVALID', 'headline_bio payload requires headline and bio strings.');
    }
    return payload;
  }
  if (section === 'contact') {
    validateContact(payload);
    return payload;
  }
  if (!Array.isArray(payload)) {
    throw badRequest('PAYLOAD_NOT_ARRAY', `${section} payload must be an array.`);
  }
  const items = payload as SectionItem[];
  if (items.length > MAX_SECTION_ITEMS) {
    throw badRequest('PAYLOAD_TOO_MANY_ITEMS', `${section} can have at most ${MAX_SECTION_ITEMS} items.`);
  }
  for (const item of items) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw badRequest('PAYLOAD_ITEM_INVALID', `${section} payload items must be objects.`);
    }
    if (item.id !== undefined && typeof item.id !== 'string') {
      throw badRequest('PAYLOAD_ITEM_INVALID', `${section} item id must be a string when present.`);
    }
  }

  if ((PER_ITEM_PROOF_SECTIONS as readonly string[]).includes(section)) {
    for (const item of items) validateProofAttachments(section, item.proofAttachments);
  }
  if (section === 'engagements') items.forEach(validateEngagement);
  if (section === 'testimonials') items.forEach(validateTestimonial);
  if (section === 'key_clients') {
    if (items.length > MAX_KEY_CLIENTS) {
      throw badRequest('KEY_CLIENTS_LIMIT_EXCEEDED', `You can list at most ${MAX_KEY_CLIENTS} key clients.`);
    }
    items.forEach(validateKeyClient);
  }
  if (section === 'work_experiences') {
    for (const item of items) {
      if (!Number.isInteger(item.startYear)) {
        throw badRequest('WORK_HISTORY_INVALID', 'Each work experience requires an integer startYear.');
      }
      if (typeof item.isCurrent !== 'boolean') {
        throw badRequest('WORK_HISTORY_INVALID', 'Each work experience requires an isCurrent boolean.');
      }
    }
    assertValidWorkHistory(items as unknown as WorkSpan[]);
    return sortWorkHistoryNewestFirst(items as unknown as (WorkSpan & SectionItem)[]);
  }
  return payload;
}
