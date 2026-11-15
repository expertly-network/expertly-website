import { describe, expect, it } from 'vitest';
import { applyVerificationRules, isContactChanged, isMaterialChange, isSectionUnchanged } from './member-verification';

const award = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  title: 'Best Tax Firm',
  issuingBody: 'ET',
  year: 2023,
  description: 'Won it',
  isVerified: true,
  ...over,
});

describe('applyVerificationRules', () => {
  it('keeps the tick when only a non-key field (description) changes', () => {
    const [out] = applyVerificationRules('awards', [award()], [award({ description: 'Fixed a typo' })]);
    expect(out.isVerified).toBe(true);
  });

  it('keeps the tick when proof is added', () => {
    const [out] = applyVerificationRules('awards', [award()], [award({ proofAttachments: [{ type: 'link' }] })]);
    expect(out.isVerified).toBe(true);
  });

  it.each([
    ['title', { title: 'Another award' }],
    ['issuingBody', { issuingBody: 'Mint' }],
    ['year', { year: 2024 }],
  ])('resets the tick when %s changes', (_key, change) => {
    const [out] = applyVerificationRules('awards', [award()], [award(change)]);
    expect(out.isVerified).toBe(false);
  });

  it('stamps changedAt on a new item and on a key-field change, but not on a typo in a description', () => {
    const now = new Date('2026-11-20T10:00:00Z');
    const live = award({ changedAt: '2026-01-01T00:00:00Z', verifiedAt: '2026-02-01T00:00:00Z' });
    const [changed] = applyVerificationRules('awards', [live], [award({ title: 'New title' })], now);
    expect(changed).toMatchObject({
      isVerified: false,
      changedAt: now.toISOString(),
      verifiedAt: '2026-02-01T00:00:00Z',
    });
    const [typo] = applyVerificationRules('awards', [live], [award({ description: 'Fixed' })], now);
    expect(typo).toMatchObject({ isVerified: true, changedAt: '2026-01-01T00:00:00Z' });
    const [created] = applyVerificationRules('awards', [], [{ title: 'New' }], now);
    expect(created).toMatchObject({ isVerified: false, changedAt: now.toISOString() });
    expect(created.verifiedAt).toBeUndefined();
  });

  it('never trusts changedAt or verifiedAt from the payload', () => {
    const now = new Date('2026-11-20T10:00:00Z');
    const [out] = applyVerificationRules('awards', [], [{ title: 'X', changedAt: 'x', verifiedAt: 'y' }], now);
    expect(out.changedAt).toBe(now.toISOString());
    expect(out.verifiedAt).toBeUndefined();
  });

  it('marks a new item (no id, or an unknown id) unverified', () => {
    const out = applyVerificationRules('awards', [award()], [award(), { title: 'New' }, award({ id: 'zzz' })]);
    expect(out.map((i) => i.isVerified)).toEqual([true, false, false]);
  });

  it('never trusts isVerified from the payload', () => {
    const [out] = applyVerificationRules('awards', [], [award({ id: undefined, isVerified: true })]);
    expect(out.isVerified).toBe(false);
  });

  it('does not verify an item that was not verified before', () => {
    const [out] = applyVerificationRules('awards', [award({ isVerified: false })], [award()]);
    expect(out.isVerified).toBe(false);
  });

  it('treats empty and missing values as equal (no reset)', () => {
    const live = { id: 'e1', title: 'Deal', clientName: 'Acme', year: null, url: null, isVerified: true };
    const [out] = applyVerificationRules('engagements', [live], [{ ...live, url: '', year: undefined }]);
    expect(out.isVerified).toBe(true);
  });

  it('resets when an engagement becomes confidential', () => {
    const live = { id: 'e1', title: 'Deal', clientName: 'Acme', isVerified: true };
    const [out] = applyVerificationRules('engagements', [live], [{ ...live, isConfidential: true }]);
    expect(out.isVerified).toBe(false);
  });
});

describe('isMaterialChange', () => {
  it('ignores surrounding whitespace in text', () => {
    expect(isMaterialChange('awards', award(), award({ title: '  Best Tax Firm ' }))).toBe(false);
  });
});

describe('isSectionUnchanged', () => {
  const fields = ['id', 'title', 'issuingBody', 'year', 'description', 'proofAttachments'];
  it('is true for an identical list', () => {
    expect(isSectionUnchanged('awards', fields, [award()], [award()])).toBe(true);
  });
  it('is false when anything differs, including a typo fix', () => {
    expect(isSectionUnchanged('awards', fields, [award()], [award({ description: 'Won it!' })])).toBe(false);
  });
  it('is false when an item is added, removed or reordered', () => {
    const second = award({ id: 'a2', title: 'Other' });
    expect(isSectionUnchanged('awards', fields, [award()], [award(), second])).toBe(false);
    expect(isSectionUnchanged('awards', fields, [award(), second], [award()])).toBe(false);
    expect(isSectionUnchanged('awards', fields, [award(), second], [second, award()])).toBe(false);
  });
  it('is false when an item has no id (it is new)', () => {
    expect(isSectionUnchanged('awards', fields, [award()], [award({ id: undefined })])).toBe(false);
  });
  it('is false when proof changes', () => {
    expect(isSectionUnchanged('awards', fields, [award()], [award({ proofAttachments: [{ type: 'link' }] })])).toBe(
      false
    );
  });
});

describe('isContactChanged', () => {
  const live = { workEmail: 'a@firm.com', contactPhone: null, linkedinUrl: 'https://li/in/a', website: null };
  it('is false for the same values', () => {
    expect(isContactChanged(live, { ...live, website: '' })).toBe(false);
  });
  it('is true when a field changes', () => {
    expect(isContactChanged(live, { ...live, workEmail: 'b@firm.com' })).toBe(true);
  });
});
