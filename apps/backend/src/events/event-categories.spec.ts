import { describe, expect, it } from 'vitest';
import { inferEventCategoryIds, inferEventCategoryNames } from './event-categories';

describe('inferEventCategoryNames', () => {
  it('tags GST events as Indirect Tax only', () => {
    expect(inferEventCategoryNames('Seminar on 57th GST Council Update', 'Changes to tax rates and returns.')).toEqual([
      'Indirect Tax',
    ]);
  });

  it('uses a bare "tax" as Direct Tax when nothing more specific matches', () => {
    expect(inferEventCategoryNames('Fundamental elements of the tax system', null)).toEqual(['Direct Tax']);
  });

  it('ranks title matches above description matches and keeps at most three', () => {
    const names = inferEventCategoryNames(
      'Transfer pricing and M&A in 2026',
      'Covers audit, arbitration, insolvency and GDPR along the way.'
    );
    expect(names).toHaveLength(3);
    expect(names.slice(0, 2).sort()).toEqual(['Corporate, M&A & Capital Markets', 'Direct Tax']);
  });

  it('does not read the future tense "will" as wills', () => {
    expect(inferEventCategoryNames('What the market will do next', null)).toEqual([]);
  });

  it('leaves an event untagged when nothing matches', () => {
    expect(inferEventCategoryNames('Leading with a Growth Mindset', 'An evening of networking.')).toEqual([]);
  });
});

describe('inferEventCategoryIds', () => {
  it('maps names to ids and skips unknown categories', () => {
    expect(inferEventCategoryIds('GST and IFRS update', null, new Map([['Indirect Tax', 'id-1']]))).toEqual(['id-1']);
  });
});
