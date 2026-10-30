import { describe, expect, it } from 'vitest';
import { externalHref, externalLink } from './format';

describe('externalHref', () => {
  it.each([
    ['https://www.firm.com', 'https://www.firm.com/'],
    ['http://firm.com/path?q=1#x', 'http://firm.com/path?q=1#x'],
    ['  https://linkedin.com/in/jane  ', 'https://linkedin.com/in/jane'],
    // Scheme-less values (many stored ones are) are read as https.
    ['www.firm.com', 'https://www.firm.com/'],
    ['firm.com/about', 'https://firm.com/about'],
    ['www.firm.com:8080/x', 'https://www.firm.com:8080/x'],
    ['//firm.com/x', 'https://firm.com/x'],
  ])('links %j as %j', (raw, href) => {
    expect(externalHref(raw)).toBe(href);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(document.cookie)',
    ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'mailto:jane@firm.com',
    'https://user:pass@firm.com',
    'https://user@evil.com',
    'https://localhost',
    'intranet',
    '',
    '   ',
    null,
    undefined,
  ])('never links %j', (raw) => {
    expect(externalHref(raw)).toBeNull();
  });

  it('externalLink wraps a safe href and drops an unsafe one', () => {
    expect(externalLink('firm.com', 'Website')).toEqual({ href: 'https://firm.com/', label: 'Website' });
    expect(externalLink('javascript:alert(1)', 'Website')).toBeUndefined();
  });
});
