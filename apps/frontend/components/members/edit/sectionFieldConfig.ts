import type { MemberEditSection } from '@shared/member';

// One structured field per real payload property, rendered by SectionEditModal.
export type FieldSpec =
  | { key: string; label: string; type: 'text' | 'url' | 'email' | 'tel'; required?: boolean }
  | { key: string; label: string; type: 'textarea'; required?: boolean }
  | { key: string; label: string; type: 'number'; required?: boolean; min?: number; max?: number }
  | { key: string; label: string; type: 'verification-methods' }
  | { key: string; label: string; type: 'checkbox' };

export type SectionShape =
  | 'fields' // single structured form, no proof — headline_bio, contact
  | 'list-shared-proof' // repeatable rows, one proof for the whole batch — education, work_experiences
  | 'list-per-item-proof' // repeatable rows, optional proof per row — engagements, testimonials, awards
  | 'clients'; // repeatable rows, per-row logo upload instead of proof — key_clients

export interface SectionConfig {
  shape: SectionShape;
  fields: FieldSpec[];
  maxItems?: number; // only meaningful for list/clients shapes
}

// Key clients cap (mirrors the backend's KEY_CLIENTS_LIMIT_EXCEEDED rule; shared-types is type-only).
export const KEY_CLIENTS_MAX = 20;

// Mirrors ENGAGEMENT_VERIFICATION_METHODS in shared-types (type-only folder, so kept local).
export const VERIFICATION_METHOD_OPTIONS = [
  { value: 'engagement_letter', label: 'Engagement letter' },
  { value: 'client_deliverable', label: 'Client deliverable' },
  { value: 'mail_confirmation_pdf', label: 'Mail confirmation (PDF)' },
  { value: 'newsletter_transaction_update', label: 'Newsletter / transaction update' },
  { value: 'other', label: 'Other' },
] as const;

export const SECTION_TITLES: Record<MemberEditSection, string> = {
  headline_bio: 'Headline & Bio',
  contact: 'Contact Information',
  engagements: 'Key Engagements',
  education: 'Education',
  work_experiences: 'Work Experience',
  key_clients: 'Key Clients',
  testimonials: 'Client Testimonials',
  awards: 'Awards & Recognition',
};

export const SECTION_CONFIG: Record<MemberEditSection, SectionConfig> = {
  headline_bio: {
    shape: 'fields',
    fields: [
      { key: 'headline', label: 'Headline', type: 'text', required: true },
      { key: 'bio', label: 'Bio', type: 'textarea', required: true },
    ],
  },
  contact: {
    shape: 'fields',
    fields: [
      { key: 'contactEmail', label: 'Email', type: 'email' },
      { key: 'workEmail', label: 'Work email (optional)', type: 'email' },
      { key: 'contactPhone', label: 'Phone', type: 'tel' },
      { key: 'linkedinUrl', label: 'LinkedIn URL', type: 'url' },
      { key: 'website', label: 'Website', type: 'url' },
    ],
  },
  engagements: {
    shape: 'list-per-item-proof',
    maxItems: 10,
    fields: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'organization', label: 'Organization', type: 'text', required: true },
      { key: 'clientName', label: 'Client name', type: 'text', required: true },
      { key: 'clientEmail', label: 'Client email (optional — never shown publicly)', type: 'email' },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'url', label: 'URL', type: 'url' },
      { key: 'verificationMethods', label: 'How can this engagement be verified?', type: 'verification-methods' },
    ],
  },
  education: {
    shape: 'list-shared-proof',
    maxItems: 5,
    fields: [
      { key: 'degree', label: 'Degree', type: 'text', required: true },
      { key: 'institution', label: 'Institution', type: 'text', required: true },
      { key: 'field', label: 'Field of study', type: 'text' },
      { key: 'endYear', label: 'End year', type: 'number' },
    ],
  },
  work_experiences: {
    shape: 'list-shared-proof',
    maxItems: 15, // same as the application's cap, so an imported history always fits
    fields: [
      { key: 'title', label: 'Job title', type: 'text', required: true },
      { key: 'company', label: 'Company', type: 'text', required: true },
      { key: 'startMonth', label: 'Start month (1-12, optional)', type: 'number', min: 1, max: 12 },
      { key: 'startYear', label: 'Start year', type: 'number', required: true },
      { key: 'endMonth', label: 'End month (1-12, optional)', type: 'number', min: 1, max: 12 },
      { key: 'endYear', label: 'End year', type: 'number' },
      { key: 'isCurrent', label: 'I currently work here', type: 'checkbox' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  key_clients: {
    shape: 'clients',
    maxItems: KEY_CLIENTS_MAX,
    fields: [{ key: 'name', label: 'Client name', type: 'text', required: true }],
  },
  testimonials: {
    shape: 'list-per-item-proof',
    maxItems: 10,
    fields: [
      { key: 'quote', label: 'Quote', type: 'textarea', required: true },
      { key: 'clientName', label: 'Client name', type: 'text', required: true },
      { key: 'clientTitle', label: 'Client title', type: 'text' },
      { key: 'clientCompany', label: 'Client company', type: 'text' },
      { key: 'clientEmail', label: 'Client email (optional — never shown publicly)', type: 'email' },
      { key: 'serviceName', label: 'Service', type: 'text' },
      { key: 'occurredOn', label: 'Date (YYYY-MM-DD)', type: 'text' },
    ],
  },
  awards: {
    shape: 'list-per-item-proof',
    maxItems: 10,
    fields: [
      { key: 'title', label: 'Award title', type: 'text', required: true },
      { key: 'issuingBody', label: 'Issuing body', type: 'text' },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
};

// Empty-row factories for "+ Add another" in SectionEditModal.
export const EMPTY_ROW: Record<string, Record<string, unknown>> = {
  engagements: {
    title: '',
    organization: '',
    clientName: '',
    clientEmail: '',
    year: undefined,
    url: '',
    verificationMethods: [],
    verificationMethodOther: '',
    proofAttachments: [],
  },
  education: { degree: '', institution: '', field: '', endYear: undefined },
  work_experiences: {
    title: '',
    company: '',
    startMonth: undefined,
    startYear: undefined,
    endMonth: undefined,
    endYear: undefined,
    isCurrent: false,
    description: '',
  },
  key_clients: { name: '', logoUrl: null, logoUploadPath: undefined, proofAttachments: [] },
  testimonials: {
    quote: '',
    clientName: '',
    clientTitle: '',
    clientCompany: '',
    clientEmail: '',
    serviceName: '',
    occurredOn: '',
    proofAttachments: [],
  },
  awards: { title: '', issuingBody: '', year: undefined, description: '', proofAttachments: [] },
};
