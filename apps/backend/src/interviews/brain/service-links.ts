// Linked services (spec §5.3): practices that appear in more than one branch of the taxonomy.
// Keyed by category + service NAME (stable across environments, unlike ids). Used so the preparer
// probes a practice once and evidence can be credited to every linked node.

export interface TaxonomyEntry {
  id: string;
  category: string;
  service: string;
}

type Ref = readonly [category: string, service: string];

const LINK_GROUPS: readonly (readonly Ref[])[] = [
  [
    ['Regulatory, Competition & Public Law', 'Antitrust'],
    ['Regulatory, Competition & Public Law', 'Competition Law'],
  ],
  [
    ['Direct Tax', 'Tax Litigation & Dispute Resolutions'],
    ['Indirect Tax', 'GST / VAT/ Sales Tax litigation & dispute resolutions'],
    ['Dispute Resolution & Investigations', 'Tax litigation'],
  ],
  [
    ['Direct Tax', 'Gift, Estate, Wealth & succession planning'],
    ['Wealth Management', 'Estate and Succession Planning'],
    ['Private Client, Family & Wealth', 'Inheritance Law & Succession Planning'],
  ],
  [
    ['Corporate compliances & Secretarial assistance', 'Corporate Governance/ ESG Advisory'],
    ['Accounting & related compliances', 'Preparation of sustainability, CSR, ESG integrated reports'],
    ['Audit & Assurance', 'ESG/sustainability assurance'],
    ['Real Estate, Infrastructure & Environment', 'Environmental / ESG compliance'],
  ],
  [
    ['Corporate compliances & Secretarial assistance', 'Exchange control laws'],
    ['Regulatory, Competition & Public Law', 'Exchange control regulations/ Foreign investments'],
  ],
];

const key = (category: string, service: string): string =>
  `${category.trim().toLowerCase()}|${service.trim().toLowerCase()}`;

export function resolveLinkGroups(taxonomy: TaxonomyEntry[]): string[][] {
  const byKey = new Map(taxonomy.map((t) => [key(t.category, t.service), t.id]));
  return LINK_GROUPS.map((group) =>
    group.flatMap(([category, service]) => {
      const id = byKey.get(key(category, service));
      return id ? [id] : [];
    })
  ).filter((ids) => ids.length >= 2);
}

export function linkedIds(serviceIds: string[], groups: string[][]): Set<string> {
  const out = new Set(serviceIds);
  for (const group of groups) if (group.some((id) => out.has(id))) for (const id of group) out.add(id);
  return out;
}

/** Labels reach prompts without trailing full stops/colons (six live labels end with one). */
export function cleanLabel(label: string): string {
  return label.trim().replace(/[.:;,\s]+$/u, '');
}
