// Renders free-form multi-line text (bios pasted from LinkedIn, etc.) as real paragraphs and
// bullet lists instead of one pre-wrapped blob: every line is its own spaced paragraph (LinkedIn's
// "About" separates paragraphs with a single line break, not a blank line), and lines starting
// with "-", "•", "*" or "–" become list items.

const BULLET = /^\s*[-•*–]\s+/;

type Block = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] };

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    // Each chunk starts fresh, so a list never continues across a blank line.
    let current: Block | null = null;
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

export function FormattedText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = toBlocks(text);
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {blocks.map((block, i) =>
        block.kind === 'ul' ? (
          <ul key={i} className="flex list-disc flex-col gap-1.5 pl-5 marker:text-ink-4">
            {block.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{block.text}</p>
        )
      )}
    </div>
  );
}
