import { describe, expect, it } from 'vitest';
import { CLOSED_FACETS, matchFacetValue, slugify, type FacetValueRow } from './normaliser';

const v = (o: Partial<FacetValueRow>): FacetValueRow => ({
  id: 'id',
  facet: 'jurisdiction',
  label: 'United Kingdom',
  slug: 'united-kingdom',
  status: 'canonical',
  aliases: ['uk', 'u.k.', 'england'],
  sourceCount: 0,
  ...o,
});

describe('normaliser', () => {
  it('matches labels and aliases ignoring case and punctuation', () => {
    const values = [v({})];
    expect(matchFacetValue('the U.K.', values)).toBeNull();
    expect(matchFacetValue('U.K.', values)?.id).toBe('id');
    expect(matchFacetValue('united kingdom', values)?.id).toBe('id');
    expect(matchFacetValue('England', values)?.id).toBe('id');
  });
  it('never matches rejected values', () => {
    expect(matchFacetValue('United Kingdom', [v({ status: 'rejected' })])).toBeNull();
  });
  it('slugifies like the SQL seed', () => {
    expect(slugify('CIT(A)')).toBe('cit-a');
    expect(slugify('  Form 3CEB ')).toBe('form-3ceb');
  });
  it('treats closed facets as closed', () => {
    expect(CLOSED_FACETS.has('work_type')).toBe(true);
    expect(CLOSED_FACETS.has('instrument')).toBe(false);
    expect(CLOSED_FACETS.has('forum')).toBe(false);
  });
});
