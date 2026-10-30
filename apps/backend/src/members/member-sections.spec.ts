import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { normalizeLiveItem, validateAndPrepareEditPayload } from './member-sections';

function codeOf(run: () => unknown): string {
  try {
    run();
    return 'OK';
  } catch (err) {
    if (!(err instanceof BadRequestException)) throw err;
    return (err.getResponse() as { code: string }).code;
  }
}

const proof = (overrides: Record<string, unknown> = {}) => ({
  type: 'link',
  url: 'https://firm.com/letter',
  label: 'Engagement letter',
  ...overrides,
});

describe('validateAndPrepareEditPayload', () => {
  describe('key stripping', () => {
    it('drops unknown keys and a client-supplied isVerified from array items', () => {
      const [item] = validateAndPrepareEditPayload('awards', [
        { id: 'a1', title: 'Best Firm', year: 2024, isVerified: true, junk: '<script>', __proto__x: 1 },
      ]) as Record<string, unknown>[];
      expect(item).toEqual({ id: 'a1', title: 'Best Firm', year: 2024 });
    });

    it('keeps only headline/bio on headline_bio', () => {
      expect(validateAndPrepareEditPayload('headline_bio', { headline: 'H', bio: 'B', role: 'admin' })).toEqual({
        headline: 'H',
        bio: 'B',
      });
    });

    it('keeps only { type, url, label } on proof attachments', () => {
      const [item] = validateAndPrepareEditPayload('testimonials', [
        { quote: 'Great', proofAttachments: [{ ...proof(), path: '../../other', signedUrl: 'x' }] },
      ]) as { proofAttachments: unknown[] }[];
      expect(item.proofAttachments).toEqual([proof()]);
    });

    it('drops unknown contact keys', () => {
      expect(
        validateAndPrepareEditPayload('contact', {
          contactEmail: 'a@firm.com',
          website: 'https://firm.com',
          phoneVerified: true,
        })
      ).toEqual({ contactEmail: 'a@firm.com', website: 'https://firm.com' });
    });
  });

  describe('URL scheme rejection', () => {
    const BAD = [
      'javascript:alert(1)',
      'JAVASCRIPT:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:x',
      'https://user:pw@firm.com',
    ];

    it.each(BAD)('rejects contact.website %j', (url) => {
      expect(codeOf(() => validateAndPrepareEditPayload('contact', { website: url }))).toBe('URL_INVALID');
    });

    it.each(BAD)('rejects contact.linkedinUrl %j', (url) => {
      expect(codeOf(() => validateAndPrepareEditPayload('contact', { linkedinUrl: url }))).toBe('URL_INVALID');
    });

    it.each(BAD)('rejects an engagement url %j', (url) => {
      expect(codeOf(() => validateAndPrepareEditPayload('engagements', [{ clientName: 'Acme', url }]))).toBe(
        'URL_INVALID'
      );
    });

    it.each(BAD)('rejects a key-client logoUrl %j', (url) => {
      expect(codeOf(() => validateAndPrepareEditPayload('key_clients', [{ name: 'Acme', logoUrl: url }]))).toBe(
        'URL_INVALID'
      );
    });

    it.each(BAD)('rejects a proof link %j', (url) => {
      expect(
        codeOf(() => validateAndPrepareEditPayload('awards', [{ title: 'x', proofAttachments: [proof({ url })] }]))
      ).toBe('URL_INVALID');
    });

    it('accepts http(s) and scheme-less links, and empty optional ones', () => {
      expect(
        codeOf(() =>
          validateAndPrepareEditPayload('contact', {
            website: 'www.firm.com',
            linkedinUrl: 'https://linkedin.com/in/a',
          })
        )
      ).toBe('OK');
      expect(codeOf(() => validateAndPrepareEditPayload('contact', { website: '', linkedinUrl: null }))).toBe('OK');
    });
  });

  describe('length caps', () => {
    it.each<[string, () => unknown]>([
      ['short text (300)', () => validateAndPrepareEditPayload('awards', [{ title: 'x'.repeat(301) }])],
      [
        'long text (2000)',
        () => validateAndPrepareEditPayload('awards', [{ title: 't', description: 'x'.repeat(2001) }]),
      ],
      ['bio (5000)', () => validateAndPrepareEditPayload('headline_bio', { headline: 'h', bio: 'x'.repeat(5001) })],
      ['email (254)', () => validateAndPrepareEditPayload('contact', { contactEmail: `${'a'.repeat(250)}@firm.com` })],
      ['phone (50)', () => validateAndPrepareEditPayload('contact', { contactPhone: '1'.repeat(51) })],
      [
        'proof label (300)',
        () =>
          validateAndPrepareEditPayload('awards', [
            { title: 't', proofAttachments: [proof({ label: 'x'.repeat(301) })] },
          ]),
      ],
    ])('rejects over-long %s with FIELD_TOO_LONG', (_label, run) => {
      expect(codeOf(run)).toBe('FIELD_TOO_LONG');
    });

    it('accepts values exactly at the cap', () => {
      expect(codeOf(() => validateAndPrepareEditPayload('awards', [{ title: 'x'.repeat(300) }]))).toBe('OK');
      expect(
        codeOf(() => validateAndPrepareEditPayload('headline_bio', { headline: 'h', bio: 'x'.repeat(5000) }))
      ).toBe('OK');
    });

    it('caps item counts', () => {
      expect(
        codeOf(() =>
          validateAndPrepareEditPayload(
            'awards',
            Array.from({ length: 51 }, () => ({ title: 't' }))
          )
        )
      ).toBe('PAYLOAD_TOO_MANY_ITEMS');
      expect(
        codeOf(() =>
          validateAndPrepareEditPayload(
            'key_clients',
            Array.from({ length: 21 }, (_, i) => ({ name: `c${i}` }))
          )
        )
      ).toBe('KEY_CLIENTS_LIMIT_EXCEEDED');
    });
  });

  describe('proof attachment shape', () => {
    it.each<[string, unknown]>([
      ['not an array', 'https://firm.com'],
      ['a bad type', [proof({ type: 'script' })]],
      ['a missing url', [proof({ url: undefined })]],
      ['a blank url', [proof({ url: '   ' })]],
      ['a missing label', [proof({ label: undefined })]],
      ['more than 10 entries', Array.from({ length: 11 }, () => proof())],
    ])('rejects %s', (_label, proofAttachments) => {
      expect(codeOf(() => validateAndPrepareEditPayload('awards', [{ title: 't', proofAttachments }]))).toBe(
        'PROOF_ATTACHMENTS_INVALID'
      );
    });

    it('accepts file attachments (ownership is checked in MembersService)', () => {
      expect(
        codeOf(() =>
          validateAndPrepareEditPayload('awards', [
            { title: 't', proofAttachments: [proof({ type: 'file', url: 'm/1-x.pdf' })] },
          ])
        )
      ).toBe('OK');
    });
  });

  describe('type and required-field checks', () => {
    it.each<[string, () => unknown, string]>([
      ['non-array section payload', () => validateAndPrepareEditPayload('awards', { title: 't' }), 'PAYLOAD_NOT_ARRAY'],
      ['non-object item', () => validateAndPrepareEditPayload('awards', ['x']), 'PAYLOAD_ITEM_INVALID'],
      ['non-string id', () => validateAndPrepareEditPayload('awards', [{ id: 5, title: 't' }]), 'PAYLOAD_ITEM_INVALID'],
      [
        'number field as string',
        () => validateAndPrepareEditPayload('awards', [{ title: 't', year: '2024' }]),
        'PAYLOAD_ITEM_INVALID',
      ],
      ['missing headline', () => validateAndPrepareEditPayload('headline_bio', { bio: 'b' }), 'HEADLINE_BIO_INVALID'],
      ['contact array', () => validateAndPrepareEditPayload('contact', []), 'CONTACT_PAYLOAD_INVALID'],
      [
        'bad contact email',
        () => validateAndPrepareEditPayload('contact', { workEmail: 'nope' }),
        'CONTACT_EMAIL_INVALID',
      ],
      [
        'engagement without client',
        () => validateAndPrepareEditPayload('engagements', [{ title: 't' }]),
        'ENGAGEMENT_CLIENT_NAME_REQUIRED',
      ],
      [
        'engagement duplicate methods',
        () =>
          validateAndPrepareEditPayload('engagements', [{ clientName: 'A', verificationMethods: ['other', 'other'] }]),
        'ENGAGEMENT_VERIFICATION_METHODS_INVALID',
      ],
      [
        'key client without name',
        () => validateAndPrepareEditPayload('key_clients', [{ name: ' ' }]),
        'KEY_CLIENT_NAME_REQUIRED',
      ],
      [
        'testimonial bad email',
        () => validateAndPrepareEditPayload('testimonials', [{ quote: 'q', clientEmail: 'x@' }]),
        'TESTIMONIAL_CLIENT_EMAIL_INVALID',
      ],
      [
        'work experience without startYear',
        () => validateAndPrepareEditPayload('work_experiences', [{ title: 't', isCurrent: true }]),
        'WORK_HISTORY_INVALID',
      ],
    ])('%s → %s', (_label, run, code) => {
      expect(codeOf(run)).toBe(code);
    });

    it('returns work history newest-first', () => {
      const out = validateAndPrepareEditPayload('work_experiences', [
        { id: 'old', title: 'a', company: 'x', startYear: 2010, endYear: 2014, isCurrent: false },
        { id: 'now', title: 'b', company: 'y', startYear: 2020, isCurrent: true },
      ]) as { id: string }[];
      expect(out.map((i) => i.id)).toEqual(['now', 'old']);
    });
  });
});

describe('normalizeLiveItem', () => {
  const item = {
    id: 'e1',
    clientName: 'Acme',
    clientEmail: 'cfo@acme.com',
    proofAttachments: [proof()],
    isVerified: 'yes',
  };

  it('strips proof and the client email for non-privileged viewers', () => {
    expect(normalizeLiveItem('engagements', item, false)).toEqual({
      id: 'e1',
      clientName: 'Acme',
      isVerified: false,
      verificationMethods: [],
      verificationMethodOther: null,
    });
  });

  it('keeps them for the owner / admin', () => {
    expect(normalizeLiveItem('engagements', item, true)).toMatchObject({
      clientEmail: 'cfo@acme.com',
      proofAttachments: [proof()],
    });
  });
});
