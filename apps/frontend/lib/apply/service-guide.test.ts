import { describe, expect, it } from 'vitest';
import type { CategoryDto } from '@shared/category';
import { serviceGuideLines } from './service-guide';

const category = (id: string, line: string, name: string, services: string[]) =>
  ({
    id,
    name,
    serviceLineId: line,
    serviceLineName: line,
    services: services.map((s) => ({ id: `${id}:${s}`, name: s })),
  }) as unknown as CategoryDto;

const categories = [
  category('dt', 'Tax', 'Direct Tax', [
    'Corporate Income tax / Federal Tax',
    'Other (please specify)',
    'Capital Gains',
  ]),
  category('dp', 'Legal', 'Data Protection, Technology & IP', ['Data Protection & Privacy', 'IT Contracts']),
];

const shown = (query: string) =>
  serviceGuideLines(categories, query).flatMap((l) => l.solutions.flatMap((s) => s.problems));

describe('serviceGuideLines', () => {
  it('matches query words across columns, in any order', () => {
    expect(shown('corporate tax')).toEqual(['Corporate Income tax / Federal Tax']);
    expect(shown('direct corporate')).toEqual(['Corporate Income tax / Federal Tax']);
    expect(shown('privacy')).toEqual(['Data Protection & Privacy']);
  });

  it('shows every service of a subcategory that matches on its own', () => {
    expect(shown('direct tax')).toEqual([
      'Capital Gains',
      'Corporate Income tax / Federal Tax',
      'Other (please specify)',
    ]);
  });

  it('sorts lines, subcategories and services, keeping "Other" last', () => {
    expect(serviceGuideLines(categories, '').map((l) => l.name)).toEqual(['Legal', 'Tax']);
    expect(shown('')).toEqual([
      'Data Protection & Privacy',
      'IT Contracts',
      'Capital Gains',
      'Corporate Income tax / Federal Tax',
      'Other (please specify)',
    ]);
  });

  it('returns nothing when no word matches', () => {
    expect(serviceGuideLines(categories, 'zzqx')).toEqual([]);
  });
});
