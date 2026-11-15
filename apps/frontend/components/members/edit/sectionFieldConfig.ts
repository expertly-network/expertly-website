import type { MemberEditSection } from '@shared/member';

// One structured field per real payload property, rendered by SectionEditModal. `placeholder` is a
// sample answer, so people see what a title, a client or a company should look like; `hint` is a
// short line of guidance under the field.
interface FieldBase {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  /** 'half' sits two to a row from 640px up; the default is the full width. */
  span?: 'half';
}
export type FieldSpec =
  | (FieldBase & { type: 'text' | 'url' | 'email' | 'tel' })
  | (FieldBase & { type: 'textarea' })
  | (FieldBase & { type: 'number'; min?: number; max?: number })
  // A year chosen in a small calendar popover (back to 1950) — no free typing. `yearsAhead` allows that
  // many future years (an expected graduation); the default is none.
  | (FieldBase & { type: 'year'; yearsAhead?: number })
  | (FieldBase & { type: 'checkbox' })
  // A text input with a compact tick beside it on the same line (the client name + "Confidential").
  // The text lives under `key`, the tick under `flagKey`; `hint` is shown while the tick is off and
  // `flagHint` while it is on.
  | (FieldBase & { type: 'text-flag'; flagKey: string; flagLabel: string; flagHint: string })
  // A month + year pair (no day), stored as two numeric payload keys. `key` is only an id for the
  // field; the values live under `monthKey` / `yearKey`. `disabledWhenKey` greys it while that
  // checkbox key is ticked (an end date while "I currently work here" is).
  | (FieldBase & { type: 'month-year'; monthKey: string; yearKey: string; disabledWhenKey?: string });

export type SectionShape =
  | 'fields' // single structured form — headline_bio, contact
  | 'items' // repeatable entries, each added / edited / removed on its own
  | 'clients'; // repeatable rows edited together, per-row logo upload — key_clients

export interface SectionConfig {
  shape: SectionShape;
  fields: FieldSpec[];
  maxItems?: number; // only meaningful for list shapes
}

// Key clients cap (mirrors the backend's KEY_CLIENTS_LIMIT_EXCEEDED rule; shared-types is type-only).
export const KEY_CLIENTS_MAX = 20;

/** What counts as useful proof for each kind of entry — shown in the "Get verified faster" box. */
export const PROOF_EXAMPLES: Partial<Record<MemberEditSection, string>> = {
  engagements: 'an engagement letter, a client deliverable, or a public announcement of the deal',
  education: 'your degree certificate or transcript',
  work_experiences: 'an offer or experience letter, or a profile page that lists the role',
  testimonials: 'the email or letter the testimonial came from',
  awards: 'the award certificate or the announcement',
  key_clients: 'a contract, work order or invoice header',
};

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

/** What one entry is called in buttons and dialogs ("New engagement", "Edit award"). */
export const ITEM_NOUN: Partial<Record<MemberEditSection, string>> = {
  engagements: 'engagement',
  education: 'education',
  work_experiences: 'role',
  testimonials: 'testimonial',
  awards: 'award',
  key_clients: 'client',
};

export const SECTION_CONFIG: Record<MemberEditSection, SectionConfig> = {
  headline_bio: {
    shape: 'fields',
    fields: [
      {
        key: 'headline',
        label: 'Headline',
        type: 'text',
        required: true,
        placeholder: 'Partner at M2K Advisors',
        hint: 'Shown under your name: your current role, at whichever company you work for now.',
      },
      {
        key: 'bio',
        label: 'Bio',
        type: 'textarea',
        required: true,
        placeholder:
          'A Chartered Accountant with 19 years in cross-border tax and M&A. I help growing companies structure deals, expand into new markets and stay compliant.',
      },
    ],
  },
  contact: {
    shape: 'fields',
    fields: [
      {
        key: 'workEmail',
        span: 'half',
        label: 'Work email',
        type: 'email',
        placeholder: 'jane@yourfirm.com',
        hint: 'Shown to members and to clients who have a consultation with you.',
      },
      { key: 'contactPhone', span: 'half', label: 'Phone', type: 'tel', placeholder: '+91 98765 43210' },
      {
        key: 'linkedinUrl',
        label: 'LinkedIn',
        type: 'url',
        placeholder: 'https://www.linkedin.com/in/your-name',
      },
      { key: 'website', label: 'Company website', type: 'url', placeholder: 'https://yourfirm.com' },
    ],
  },
  engagements: {
    shape: 'items',
    maxItems: 10,
    fields: [
      {
        key: 'title',
        label: 'Engagement',
        type: 'text',
        required: true,
        placeholder: 'Cross-border restructuring ahead of a Singapore IPO',
        hint: 'What the work was, in a line.',
      },
      {
        key: 'clientName',
        label: 'Client',
        type: 'text-flag',
        placeholder: 'Acme Holdings Ltd',
        hint: 'Required unless you tick Confidential.',
        flagKey: 'isConfidential',
        flagLabel: 'Confidential',
        flagHint: 'Only you and the GrowXQ team can see this name — everyone else sees “Confidential client”.',
      },
      { key: 'year', span: 'half', label: 'Year', type: 'year' },
      {
        key: 'url',
        span: 'half',
        label: 'Link (optional)',
        type: 'url',
        placeholder: 'https://… a public write-up or case study',
      },
    ],
  },
  education: {
    shape: 'items',
    maxItems: 5,
    fields: [
      { key: 'degree', span: 'half', label: 'Degree', type: 'text', required: true, placeholder: 'MBA' },
      {
        key: 'endYear',
        span: 'half',
        label: 'Graduation year',
        type: 'year',
        yearsAhead: 6,
      },
      {
        key: 'institution',
        label: 'Institution',
        type: 'text',
        required: true,
        placeholder: 'Indian Institute of Management, Ahmedabad',
      },
      { key: 'field', label: 'Field of study', type: 'text', placeholder: 'Finance' },
    ],
  },
  work_experiences: {
    shape: 'items',
    maxItems: 15, // same as the application's cap, so an imported history always fits
    fields: [
      { key: 'title', span: 'half', label: 'Job title', type: 'text', required: true, placeholder: 'Partner' },
      { key: 'company', span: 'half', label: 'Company', type: 'text', required: true, placeholder: 'M2K Advisors' },
      {
        key: 'start',
        span: 'half',
        label: 'Start date',
        type: 'month-year',
        monthKey: 'startMonth',
        yearKey: 'startYear',
        required: true,
      },
      {
        key: 'end',
        span: 'half',
        label: 'End date',
        type: 'month-year',
        monthKey: 'endMonth',
        yearKey: 'endYear',
        disabledWhenKey: 'isCurrent',
      },
      { key: 'isCurrent', label: 'I currently work here', type: 'checkbox' },
      {
        key: 'description',
        label: 'What you did',
        type: 'textarea',
        placeholder: 'Led the tax practice: advised on M&A structuring, transfer pricing and cross-border compliance.',
      },
    ],
  },
  key_clients: {
    shape: 'clients',
    maxItems: KEY_CLIENTS_MAX,
    fields: [{ key: 'name', label: 'Client name', type: 'text', required: true, placeholder: 'Acme Holdings Ltd' }],
  },
  testimonials: {
    shape: 'items',
    maxItems: 10,
    fields: [
      {
        key: 'quote',
        label: 'Testimonial',
        type: 'textarea',
        required: true,
        placeholder: 'Clear, rigorous and always available — she made a complex restructuring feel simple.',
        hint: 'Their words, as they gave them.',
      },
      {
        key: 'clientName',
        span: 'half',
        label: "Person's name",
        type: 'text',
        required: true,
        placeholder: 'Asha Rao',
      },
      {
        key: 'clientTitle',
        span: 'half',
        label: "Person's title",
        type: 'text',
        placeholder: 'Chief Financial Officer',
      },
      { key: 'clientCompany', label: 'Company', type: 'text', placeholder: 'Acme Holdings Ltd' },
    ],
  },
  awards: {
    shape: 'items',
    maxItems: 10,
    fields: [
      { key: 'title', label: 'Award', type: 'text', required: true, placeholder: 'Tax Advisory Firm of the Year' },
      { key: 'issuingBody', span: 'half', label: 'Given by', type: 'text', placeholder: 'Economic Times' },
      { key: 'year', span: 'half', label: 'Year', type: 'year' },
      {
        key: 'description',
        label: 'About the award',
        type: 'textarea',
        placeholder: 'Recognised for cross-border M&A tax structuring across 40+ deals.',
      },
    ],
  },
};

// Empty-row factories for a new entry.
export const EMPTY_ROW: Record<string, Record<string, unknown>> = {
  engagements: { title: '', clientName: '', isConfidential: false, year: undefined, url: '', proofAttachments: [] },
  education: { degree: '', institution: '', field: '', endYear: undefined, proofAttachments: [] },
  work_experiences: {
    title: '',
    company: '',
    startMonth: undefined,
    startYear: undefined,
    endMonth: undefined,
    endYear: undefined,
    isCurrent: false,
    description: '',
    proofAttachments: [],
  },
  key_clients: { name: '', logoUrl: null, logoUploadPath: undefined, proofAttachments: [] },
  testimonials: { quote: '', clientName: '', clientTitle: '', clientCompany: '', proofAttachments: [] },
  awards: { title: '', issuingBody: '', year: undefined, description: '', proofAttachments: [] },
};
