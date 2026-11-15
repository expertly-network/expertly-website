// The PDF's fonts have no emoji, so react-pdf draws a broken glyph for each one (an envelope came
// out as overlapping strokes). The profile page renders emoji natively; the PDF drops them.
// Symbols the fonts do cover (© ® ™ arrows, bullets) are left alone.
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0E}\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

/** Removes emoji from one string and closes the gap they leave. */
export function stripEmoji(text: string): string {
  // `replace` with a global regex has no lastIndex state to trip over (unlike `.test`).
  // A keycap (1️⃣) is a plain digit plus marks, so drop the whole sequence, digit included.
  const stripped = text.replace(/[0-9#*]\u{FE0F}?\u{20E3}/gu, '').replace(EMOJI, '');
  if (stripped === text) return text;
  return stripped.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+$/gm, '');
}

/** A copy of `value` with emoji removed from every string in it, however deep. */
export function stripEmojiDeep<T>(value: T): T {
  if (typeof value === 'string') return stripEmoji(value) as T;
  if (Array.isArray(value)) return value.map((v) => stripEmojiDeep(v)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripEmojiDeep(v)])) as T;
  }
  return value;
}
