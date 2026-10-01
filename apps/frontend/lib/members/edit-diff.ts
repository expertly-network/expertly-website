import type { MemberEditCurrentValues, MemberEditSection, ProofAttachment } from '@shared/member';

// Builds the admin review page's "current vs proposed" view for one edit. A member always
// submits a whole section at once (see docs/rest-api.md), so for list sections the useful answer
// to "what changed?" is item-level: which entries were added, removed, changed, or left alone.

export interface FieldChange {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

export type ItemChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface ItemView {
  title: string;
  meta: string;
  body: string | null;
  /** key_clients: the live logo URL, if any. */
  logoUrl: string | null;
  /** key_clients: a newly uploaded logo (private storage path), pending approval. */
  logoUploadPath: string | null;
}

export interface ItemChange {
  kind: ItemChangeKind;
  item: ItemView;
  /** The live item this one replaces — only for `changed`. */
  before: ItemView | null;
  proofAttachments: ProofAttachment[];
}

export type SectionDiff =
  | { shape: 'fields'; fields: FieldChange[] }
  | { shape: 'items'; items: ItemChange[] };

type Item = Record<string, unknown>;

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function joinMeta(parts: unknown[]): string {
  return parts.map(str).filter(Boolean).join(' · ');
}

// How each list section's item reads in the review UI — same fields the public profile shows.
function viewOf(section: MemberEditSection, item: Item): ItemView {
  const logo = {
    logoUrl: typeof item.logoUrl === 'string' && item.logoUrl ? item.logoUrl : null,
    logoUploadPath: typeof item.logoUploadPath === 'string' && item.logoUploadPath ? item.logoUploadPath : null,
  };
  switch (section) {
    case 'engagements':
      return { title: str(item.title), meta: joinMeta([item.organization, item.year, item.url]), body: null, logoUrl: null, logoUploadPath: null };
    case 'education':
      return { title: str(item.degree), meta: joinMeta([item.institution, item.field, item.endYear]), body: null, logoUrl: null, logoUploadPath: null };
    case 'work_experiences': {
      const end = item.isCurrent ? 'Present' : str(item.endYear);
      const range = str(item.startYear) ? `${str(item.startYear)} – ${end}` : '';
      return { title: str(item.title), meta: joinMeta([item.company, range]), body: str(item.description) || null, logoUrl: null, logoUploadPath: null };
    }
    case 'key_clients':
      return { title: str(item.name), meta: '', body: null, ...logo };
    case 'testimonials':
      return {
        title: str(item.clientName),
        meta: joinMeta([item.clientTitle, item.clientCompany, item.serviceName, item.occurredOn]),
        body: str(item.quote) || null,
        logoUrl: null,
        logoUploadPath: null,
      };
    case 'awards':
      return { title: str(item.title), meta: joinMeta([item.issuingBody, item.year]), body: str(item.description) || null, logoUrl: null, logoUploadPath: null };
    default:
      return { title: '', meta: '', body: null, logoUrl: null, logoUploadPath: null };
  }
}

// Everything the reviewer sees for an item — two items with the same signature are "unchanged".
function signature(view: ItemView): string {
  return JSON.stringify([view.title.toLowerCase(), view.meta, view.body, view.logoUrl, view.logoUploadPath]);
}

function diffItems(section: MemberEditSection, current: Item[], proposed: Item[]): ItemChange[] {
  const currentViews = current.map((c) => viewOf(section, c));
  const used = new Set<number>();
  const result: ItemChange[] = [];

  const proposedViews = proposed.map((p) => ({
    view: viewOf(section, p),
    proof: Array.isArray(p.proofAttachments) ? (p.proofAttachments as ProofAttachment[]) : [],
  }));

  // Pass 1: identical items.
  const matched = proposedViews.map(({ view }) => {
    const i = currentViews.findIndex((c, idx) => !used.has(idx) && signature(c) === signature(view));
    if (i >= 0) used.add(i);
    return i;
  });

  // Pass 2: same title, different details -> "changed"; otherwise "added".
  proposedViews.forEach(({ view, proof }, pi) => {
    if (matched[pi] >= 0) {
      result.push({ kind: 'unchanged', item: view, before: null, proofAttachments: proof });
      return;
    }
    const key = view.title.toLowerCase();
    const i = currentViews.findIndex((c, idx) => !used.has(idx) && key !== '' && c.title.toLowerCase() === key);
    if (i >= 0) {
      used.add(i);
      result.push({ kind: 'changed', item: view, before: currentViews[i], proofAttachments: proof });
    } else {
      result.push({ kind: 'added', item: view, before: null, proofAttachments: proof });
    }
  });

  currentViews.forEach((view, i) => {
    if (!used.has(i)) result.push({ kind: 'removed', item: view, before: null, proofAttachments: [] });
  });

  return result;
}

function field(label: string, before: unknown, after: unknown): FieldChange {
  const b = str(before);
  const a = str(after);
  return { label, before: b, after: a, changed: a !== b };
}

export function diffEdit(section: MemberEditSection, payload: unknown, current: MemberEditCurrentValues): SectionDiff {
  if (section === 'headline_bio') {
    const p = (payload ?? {}) as Item;
    return {
      shape: 'fields',
      fields: [
        field('Headline', current.headline_bio.headline, p.headline),
        field('Bio', current.headline_bio.bio, p.bio),
      ],
    };
  }
  if (section === 'contact') {
    const p = (payload ?? {}) as Item;
    return {
      shape: 'fields',
      fields: [
        field('Email', current.contact.contactEmail, p.contactEmail),
        field('Phone', current.contact.contactPhone, p.contactPhone),
        field('LinkedIn', current.contact.linkedinUrl, p.linkedinUrl),
        field('Website', current.contact.website, p.website),
      ],
    };
  }
  const proposed = Array.isArray(payload) ? (payload as Item[]) : [];
  const live = (current[section] ?? []) as unknown as Item[];
  return { shape: 'items', items: diffItems(section, live, proposed) };
}

export function countChanges(diff: SectionDiff): number {
  return diff.shape === 'fields'
    ? diff.fields.filter((f) => f.changed).length
    : diff.items.filter((i) => i.kind !== 'unchanged').length;
}
