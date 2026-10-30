import { describe, expect, it } from 'vitest';
import { redactCardText, redactResponseText, scrubResponse } from './redaction';

// Contact details must never reach OpenAI or a search response. These are the cases the
// redaction was tuned against — a phone in any common local format is removed; years, dates,
// prices, ids and storage paths are left intact.
const PHONES = [
  '(555) 123-4567',
  '555-123-4567',
  '555.123.4567',
  '98765 43210',
  '919876543210',
  '+91 98765-43210',
  '0091 98765 43210',
  'wa.me/919876543210',
  'https://wa.me/919876543210?text=hi',
  'https://api.whatsapp.com/send?phone=919876543210',
  '+1 (555) 123-4567',
  'Call me on 9876543210.',
  'Phone:9876543210',
  '+44 20 7946 0958',
  '987 654 3210',
];

const NOT_PHONES = [
  '2019-2024',
  '2010 - 2015, 2016 - 2020',
  '1,500,000',
  'INR 15,00,000',
  '2024-10-30',
  '30.10.2026',
  '1 500 000 000',
  '1.500.000.000',
  'Founded 1998',
  '550e8400-e29b-41d4-a716-446655440000',
  'members/abc/1698765432101-file.pdf',
  '15 years',
  '2026-10-30T12:00:00.000Z',
  'id-9876543210x',
  '123456789',
];

const EMAILS = ['a@b.com', 'first.last+tag@sub.firm.co.in', 'UPPER_CASE@Example.ORG'];

describe.each([
  ['redactCardText', redactCardText],
  ['redactResponseText', redactResponseText],
])('%s', (_name, redact) => {
  it.each(PHONES)('removes phone %j', (phone) => {
    const out = redact(`x ${phone} y`);
    expect(out).toContain('[phone removed]');
    // No run of the number's digits survives.
    const digits = phone.replace(/\D/g, '');
    expect(out.replace(/\D/g, '')).not.toContain(digits.slice(-7));
  });

  it.each(NOT_PHONES)('leaves %j alone', (text) => {
    expect(redact(`x ${text} y`)).toBe(`x ${text} y`);
  });

  it.each(EMAILS)('removes email %j', (email) => {
    expect(redact(`contact ${email} today`)).toBe('contact [email removed] today');
  });

  it('removes an email and a phone in the same text', () => {
    expect(redact('a@b.com and +91 98765 43210')).toBe('[email removed] and [phone removed]');
  });
});

describe('scrubResponse', () => {
  it('redacts every string in a nested value and leaves other values alone', () => {
    const input = {
      answer: 'Reach her at jane@firm.com or +91 98765 43210',
      count: 3,
      ok: true,
      none: null,
      cards: [{ name: 'Jane', about: 'WhatsApp https://wa.me/919876543210' }, 'call 555-123-4567'],
    };
    expect(scrubResponse(input)).toEqual({
      answer: 'Reach her at [email removed] or [phone removed]',
      count: 3,
      ok: true,
      none: null,
      cards: [{ name: 'Jane', about: 'WhatsApp [phone removed]' }, 'call [phone removed]'],
    });
  });
});
