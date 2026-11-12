import { describe, expect, it } from 'vitest';
import { cleanLabel, linkedIds, resolveLinkGroups, type TaxonomyEntry } from './service-links';

const TAX: TaxonomyEntry[] = [
  { id: 'a', category: 'Regulatory, Competition & Public Law', service: 'Antitrust' },
  { id: 'b', category: 'Regulatory, Competition & Public Law', service: 'Competition Law' },
  { id: 'c', category: 'Direct Tax', service: 'Transfer pricing' },
  { id: 'd', category: 'Direct Tax', service: 'Tax Litigation & Dispute Resolutions' },
  { id: 'e', category: 'Dispute Resolution & Investigations', service: 'Tax litigation' },
];

describe('service links', () => {
  it('resolves groups by category + service name and skips groups with fewer than 2 matches', () => {
    const groups = resolveLinkGroups(TAX);
    expect(groups).toContainEqual(['a', 'b']);
    expect(groups).toContainEqual(['d', 'e']);
    expect(groups.flat()).not.toContain('c');
  });
  it('linkedIds adds every id sharing a group', () => {
    const groups = resolveLinkGroups(TAX);
    expect([...linkedIds(['a', 'c'], groups)].sort()).toEqual(['a', 'b', 'c']);
  });
  it('cleanLabel strips trailing punctuation and whitespace', () => {
    expect(cleanLabel('Tax due diligence. ')).toBe('Tax due diligence');
    expect(cleanLabel('Leveraged finance / acquisition finance:')).toBe('Leveraged finance / acquisition finance');
  });
});
