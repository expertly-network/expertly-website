// Splits free-form multi-line text (bios pasted from LinkedIn, role descriptions) into paragraphs
// and bullet lists: every line is its own paragraph (LinkedIn's "About" separates paragraphs with
// a single line break, not a blank line), and lines starting with "-", "•", "*" or "–" become list
// items. Shared by the web renderer (components/shared/FormattedText.tsx) and the member profile
// PDF (components/members/pdf/MemberProfilePdf.tsx), so both always format text the same way.

const BULLET = /^\s*[-•*–]\s+/;

export type TextBlock = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

export function toTextBlocks(text: string): TextBlock[] {
  const blocks: TextBlock[] = [];
  for (const chunk of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    // Each chunk starts fresh, so a list never continues across a blank line.
    let current: TextBlock | null = null;
    for (const line of lines) {
      if (BULLET.test(line)) {
        const item = line.replace(BULLET, '');
        if (current?.kind === 'ul') current.items.push(item);
        else blocks.push((current = { kind: 'ul', items: [item] }));
      } else {
        blocks.push((current = { kind: 'p', text: line }));
      }
    }
  }
  return blocks;
}
