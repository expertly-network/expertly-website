import { describe, expect, it } from 'vitest';
import { stripEmoji, stripEmojiDeep } from './strip-emoji';

describe('stripEmoji', () => {
  it('removes an emoji and the gap it leaves', () => {
    expect(stripEmoji('email me at 📩 jane@x.com or DM')).toBe('email me at jane@x.com or DM');
  });
  it('removes variation selectors, ZWJ sequences and keycaps', () => {
    expect(stripEmoji('hi ✉️ 👩‍💻 1️⃣ there')).toBe('hi there');
  });
  it('leaves plain text and covered symbols untouched', () => {
    expect(stripEmoji('© 2026 – “quoted” • item')).toBe('© 2026 – “quoted” • item');
  });
  it('cleans every string in a nested object, leaving other values', () => {
    expect(stripEmojiDeep({ a: 'x 🚀', n: 3, b: [{ c: 'y 🎉 z' }], u: null })).toEqual({
      a: 'x',
      n: 3,
      b: [{ c: 'y z' }],
      u: null,
    });
  });
});
