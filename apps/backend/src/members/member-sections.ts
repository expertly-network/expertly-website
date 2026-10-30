import { BadRequestException } from '@nestjs/common';
import type { EngagementVerificationMethod, MemberEditSection } from '@shared/member';
import { assertValidWorkHistory, sortWorkHistoryNewestFirst, type WorkSpan } from '../common/work-history';
import { isHttpUrl, MAX_URL_LENGTH } from '../common/http-url';

export type SectionItem = Record<string, unknown>;

// Array-shaped sections whose items carry their own proofAttachments (as opposed to
// education/work_experiences, which share one edit-level proof for the whole batch).
export const PER_ITEM_PROOF_SECTIONS: readonly MemberEditSection[] = [
  'engagements',
  'testimonials',
  'awards',
  'key_clients',
];

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

// Length caps per field kind. Short text matches the edit modal's text inputs (maxLength 300),
// long text its textareas (2000); bio gets more room.
const MAX_SHORT_TEXT = 300;
const MAX_LONG_TEXT = 2000;
const MAX_BIO_LENGTH = 5000;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 50;

type FieldKind = 'short' | 'long' | 'bio' | 'url' | 'email' | 'phone' | 'number' | 'boolean' | 'raw';

const FIELD_MAX_LENGTH: Partial<Record<FieldKind, number>> = {
  short: MAX_SHORT_TEXT,
  long: MAX_LONG_TEXT,
  bio: MAX_BIO_LENGTH,
  url: MAX_URL_LENGTH,
  email: MAX_EMAIL_LENGTH,
  phone: MAX_PHONE_LENGTH,
};

// Every key a submitted payload (or payload item) may carry, per section — mirrors the *EditPayload
// types in packages/shared-types/member.ts. Anything else (isVerified, client-side keys, extra
// junk) is dropped before the payload is stored. 'raw' keys get their own validation below.
const SECTION_FIELDS: Record<MemberEditSection, Record<string, FieldKind>> = {
  headline_bio: { headline: 'short', bio: 'bio' },
  contact: { contactEmail: 'email', workEmail: 'email', contactPhone: 'phone', linkedinUrl: 'url', website: 'url' },
  engagements: {
    id: 'short',
    title: 'short',
    organization: 'short',
    clientName: 'short',
    clientEmail: 'email',
    verificationMethods: 'raw',
    verificationMethodOther: 'raw',
    year: 'number',
    url: 'url',
    proofAttachments: 'raw',
  },
  education: { id: 'short', degree: 'short', institution: 'short', field: 'short', endYear: 'number' },
  work_experiences: {
    id: 'short',
    title: 'short',
    company: 'short',
    startMonth: 'number',
    startYear: 'number',
    endMonth: 'number',
    endYear: 'number',
    isCurrent: 'boolean',
    description: 'long',
  },
  key_clients: { id: 'short', name: 'short', logoUrl: 'url', logoUploadPath: 'short', proofAttachments: 'raw' },
  testimonials: {
    id: 'short',
    quote: 'long',
    clientName: 'short',
    clientTitle: 'short',
    clientCompany: 'short',
    serviceName: 'short',
    occurredOn: 'short',
    clientEmail: 'email',
    proofAttachments: 'raw',
  },
  awards: {
    id: 'short',
    title: 'short',
    issuingBody: 'short',
    year: 'number',
    description: 'long',
    proofAttachments: 'raw',
  },
};

// Keeps only the section's known keys and checks each value's type and length. Null/undefined
// pass (required fields are checked by the per-section validators).
function pickKnownFields(section: MemberEditSection, value: SectionItem): SectionItem {
  const fields = SECTION_FIELDS[section];
  const out: SectionItem = {};
  for (const [key, kind] of Object.entries(fields)) {
    if (!(key in value)) continue;
    const v = value[key];
    out[key] = v;
    if (v == null || kind === 'raw') continue;
    if (kind === 'number' && typeof v !== 'number') {
      throw badRequest('PAYLOAD_ITEM_INVALID', `${section}.${key} must be a number or null.`);
    }
    if (kind === 'boolean' && typeof v !== 'boolean') {
      throw badRequest('PAYLOAD_ITEM_INVALID', `${section}.${key} must be a boolean.`);
    }
    const max = FIELD_MAX_LENGTH[kind];
    if (max !== undefined) {
      if (typeof v !== 'string')
        throw badRequest('PAYLOAD_ITEM_INVALID', `${section}.${key} must be a string or null.`);
      if (v.length > max) throw badRequest('FIELD_TOO_LONG', `${section}.${key} can be at most ${max} characters.`);
    }
  }
  return out;
}

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
    if ((attachment.url as string).length > MAX_URL_LENGTH || (attachment.label as string).length > MAX_SHORT_TEXT) {
      throw badRequest('FIELD_TOO_LONG', `${section} proof attachment url or label is too long.`);
    }
    if (attachment.type === 'link' && !isHttpUrl(attachment.url)) {
      throw badRequest('URL_INVALID', `${section} proof links must be http(s) web addresses.`);
    }
  }
}

// Proof attachment entries keep only { type, url, label } (validated by validateProofAttachments).
function pickProofAttachments(item: SectionItem): SectionItem {
  if (!Array.isArray(item.proofAttachments)) return item;
  return {
    ...item,
    proofAttachments: (item.proofAttachments as { type: unknown; url: unknown; label: unknown }[]).map((a) => ({
      type: a.type,
      url: a.url,
      label: a.label,
    })),
  };
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
    return pickKnownFields(section, payload as SectionItem);
  }
  if (section === 'contact') {
    validateContact(payload);
    return pickKnownFields(section, payload as SectionItem);
  }
  if (!Array.isArray(payload)) {
    throw badRequest('PAYLOAD_NOT_ARRAY', `${section} payload must be an array.`);
  }
  if (payload.length > MAX_SECTION_ITEMS) {
    throw badRequest('PAYLOAD_TOO_MANY_ITEMS', `${section} can have at most ${MAX_SECTION_ITEMS} items.`);
  }
  for (const item of payload as unknown[]) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw badRequest('PAYLOAD_ITEM_INVALID', `${section} payload items must be objects.`);
    }
    if ((item as SectionItem).id !== undefined && typeof (item as SectionItem).id !== 'string') {
      throw badRequest('PAYLOAD_ITEM_INVALID', `${section} item id must be a string when present.`);
    }
  }
  // From here on only the section's known keys exist (see SECTION_FIELDS).
  const items = (payload as SectionItem[]).map((item) => pickKnownFields(section, item));

  if ((PER_ITEM_PROOF_SECTIONS as readonly string[]).includes(section)) {
    for (const item of items) validateProofAttachments(section, item.proofAttachments);
    items.forEach((item, i) => (items[i] = pickProofAttachments(item)));
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
  return items;
}
