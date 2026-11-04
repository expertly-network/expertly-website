import { describe, expect, it } from 'vitest';
import { companyKey, shareCompanyWebsites } from './company-websites';

const role = (company: string, companyUrl = '', isCurrent = false) => ({
  title: 'Partner',
  company,
  companyUrl,
  isCurrent,
  startYear: 2020,
});

describe('company websites', () => {
  it('matches capitalization and extra spaces without merging distinct companies', () => {
    expect(companyKey('  Acme   Ltd ')).toBe(companyKey('ACME Ltd'));
    const result = shareCompanyWebsites([
      role('Acme Ltd', '', true),
      role(' ACME  Ltd ', 'https://acme.com'),
      role('Acme Inc'),
    ]);
    expect(result.map((r) => r.companyUrl)).toEqual(['https://acme.com', 'https://acme.com', '']);
  });

  it('retains the shared website when a role is removed and when reordered', () => {
    const shared = shareCompanyWebsites([role('Acme', 'https://acme.com'), role('Acme', '', true)]);
    expect(shareCompanyWebsites(shared.slice(1))[0].companyUrl).toBe('https://acme.com');
    expect(shareCompanyWebsites([...shared].reverse()).map((r) => r.companyUrl)).toEqual([
      'https://acme.com',
      'https://acme.com',
    ]);
  });

  it('leaves unnamed companies independent and resolves old conflicting URLs consistently', () => {
    const result = shareCompanyWebsites([
      role('', 'https://personal.com'),
      role(''),
      role('Acme', 'https://acme.com'),
      role('Acme', 'https://old.acme.com'),
    ]);
    expect(result.map((r) => r.companyUrl)).toEqual([
      'https://personal.com',
      '',
      'https://acme.com',
      'https://acme.com',
    ]);
    expect(shareCompanyWebsites(result)).toEqual(result);
  });
});
