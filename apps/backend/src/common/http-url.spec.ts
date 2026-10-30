import { describe, expect, it } from 'vitest';
import { MAX_URL_LENGTH, isHttpUrl, toHttpUrl } from './http-url';

describe('isHttpUrl / toHttpUrl', () => {
  it.each([
    'https://www.firm.com',
    'http://firm.com/path?q=1#x',
    'https://linkedin.com/in/someone',
    '  https://firm.com  ',
  ])('accepts %j', (value) => {
    expect(isHttpUrl(value)).toBe(true);
  });

  it.each([
    ['www.firm.com', 'https://www.firm.com/'],
    ['firm.com/about', 'https://firm.com/about'],
    ['www.firm.com:8080/x', 'https://www.firm.com:8080/x'],
    ['//firm.com/x', 'https://firm.com/x'],
  ])('reads scheme-less %j as https', (value, href) => {
    expect(toHttpUrl(value)?.href).toBe(href);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(document.cookie)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://firm.com',
    'mailto:a@firm.com',
    'https://user:pass@firm.com',
    'https://user@firm.com',
    'https://localhost',
    'http://intranet/',
    '',
    '   ',
    `https://firm.com/${'a'.repeat(MAX_URL_LENGTH)}`,
  ])('rejects %j', (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });

  it.each([null, undefined, 42, {}, ['https://firm.com']])('rejects non-string %j', (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });
});
