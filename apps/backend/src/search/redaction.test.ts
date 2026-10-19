import { describe, expect, it } from 'vitest';
import { redactCardText, redactResponseText, scrubResponse } from './redaction';

describe('redactCardText', () => {
  it('removes a plain email', () => {
    expect(redactCardText('Mail jane@firm.com today')).toBe('Mail [email removed] today');
  });
  it('removes emails with plus signs', () => {
    expect(redactCardText('jane+tax@firm.com')).toBe('[email removed]');
  });
  it('removes emails on subdomains and multi-part TLDs', () => {
    expect(redactCardText('a.b_c%d@mail.eu.firm.co.uk')).toBe('[email removed]');
  });
  it('removes every email, not just the first', () => {
    expect(redactCardText('a@x.com; b@y.org')).toBe('[email removed]; [email removed]');
  });
  it('removes international phones with spaces', () => {
    expect(redactCardText('Call +91 98765 43210 now')).toBe('Call [phone removed] now');
  });
  it('removes international phones with brackets and dashes', () => {
    expect(redactCardText('+1 (415) 555-0132')).toBe('[phone removed]');
    expect(redactCardText('+44-20-7946-0958')).toBe('[phone removed]');
  });
  it('removes a bare 10-digit number', () => {
    expect(redactCardText('Phone 9876543210.')).toBe('Phone [phone removed].');
  });
  it('does not touch 9- or 11-digit runs without a +', () => {
    expect(redactCardText('ref 987654321')).toBe('ref 987654321');
    expect(redactCardText('ref 98765432101')).toBe('ref 98765432101');
  });
  it('removes both email and phone in one text', () => {
    expect(redactCardText('x@y.com / +91 98765 43210')).toBe('[email removed] / [phone removed]');
  });
  it('leaves text with no contact details unchanged', () => {
    const t = 'Partner at Big Four, 15 years in transfer pricing. Worked 2019-2023 on M&A tax in India.';
    expect(redactCardText(t)).toBe(t);
  });
});

describe('redactResponseText', () => {
  it('removes emails and international phones', () => {
    expect(redactResponseText('x+1@y.co.in or +91 98765 43210')).toBe('[email removed] or [phone removed]');
  });
  it('matches pipeline.ts exactly: a bare 10-digit number is NOT redacted here', () => {
    expect(redactResponseText('9876543210')).toBe('9876543210');
  });
  it('leaves clean text unchanged', () => {
    expect(redactResponseText('No contact details here.')).toBe('No contact details here.');
  });
});

describe('scrubResponse', () => {
  it('redacts strings at any depth and leaves other values alone', () => {
    const input = { a: 'mail a@b.com', n: 3, ok: true, nil: null, list: [{ p: '+91 98765 43210' }, 'fine'] };
    expect(scrubResponse(input)).toEqual({
      a: 'mail [email removed]',
      n: 3,
      ok: true,
      nil: null,
      list: [{ p: '[phone removed]' }, 'fine'],
    });
  });
});
