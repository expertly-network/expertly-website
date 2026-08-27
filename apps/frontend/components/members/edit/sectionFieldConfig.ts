import type { MemberEditSection } from '@shared/member';

// One structured field per real payload property — the deliberate
// alternative to the prototype's single-textarea `·`-split shortcut (see
// docs/rest-api.md and the design spec §7). SectionEditModal (Task 19)
// renders one <input>/<textarea> per FieldSpec, for each row in a list
// section.
export type FieldSpec =
  | { key: string; label: string; type: 'text' | 'url' | 'email' | 'tel'; required?: boolean }
  | { key: string; label: string; type: 'textarea'; required?: boolean }
  | { key: string; label: string; type: 'number'; required?: boolean }
  | { key: string; label: string; type: 'checkbox' };

export type SectionShape =
  | 'fields' // single structured form, no proof — headline_bio, contact
  | 'list-shared-proof' // repeatable rows, one proof for the whole batch — education, work_experiences
  | 'list-per-item-proof' // repeatable rows, proof per row — engagements, testimonials, awards
  | 'clients'; // repeatable rows, per-row logo upload instead of proof — key_clients

export interface SectionConfig {
  shape: SectionShape;
  fields: FieldSpec[];
  maxItems?: number; // only meaningful for list/clients shapes
}

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
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'url', label: 'URL', type: 'url' },
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
    maxItems: 10,
    fields: [
      { key: 'title', label: 'Job title', type: 'text', required: true },
      { key: 'company', label: 'Company', type: 'text', required: true },
      { key: 'startYear', label: 'Start year', type: 'number', required: true },
      { key: 'endYear', label: 'End year', type: 'number' },
      { key: 'isCurrent', label: 'I currently work here', type: 'checkbox' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  key_clients: {
    shape: 'clients',
    maxItems: 12,
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

// Empty-row factories — one per list/clients section, used by "+ Add
// another" in SectionEditModal. Kept here (not inlined) so their shape stays
// next to the FieldSpec list it must match.
export const EMPTY_ROW: Record<string, Record<string, unknown>> = {
  engagements: { title: '', organization: '', year: undefined, url: '' },
  education: { degree: '', institution: '', field: '', endYear: undefined },
  work_experiences: {
    title: '',
    company: '',
    startYear: undefined,
    endYear: undefined,
    isCurrent: false,
    description: '',
  },
  key_clients: { name: '', logoUrl: null, logoUploadPath: undefined },
  testimonials: {
    quote: '',
    clientName: '',
    clientTitle: '',
    clientCompany: '',
    serviceName: '',
    occurredOn: '',
  },
  awards: { title: '', issuingBody: '', year: undefined, description: '' },
};
