// Renders free-form multi-line text (bios pasted from LinkedIn, etc.) as real paragraphs and
// bullet lists instead of one pre-wrapped blob: blank lines split paragraphs, lines starting
// with "-", "•", "*" or "–" become list items, and single line breaks inside a paragraph stay.

const BULLET = /^\s*[-•*–]\s+/;

type Block = { kind: 'p'; lines: string[] } | { kind: 'ul'; items: string[] };

function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of text.replace(/\r\n?/g, '\n').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    // Each chunk starts fresh, so a paragraph never continues across a blank line.
    let current: Block | null = null;
    for (const line of lines) {
      if (BULLET.test(line)) {
        const item = line.replace(BULLET, '');
        if (current?.kind === 'ul') current.items.push(item);
        else blocks.push((current = { kind: 'ul', items: [item] }));
      } else if (current?.kind === 'p') {
        current.lines.push(line);
      } else {
        blocks.push((current = { kind: 'p', lines: [line] }));
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
          <p key={i}>
            {block.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {line}
              </span>
            ))}
          </p>
        )
      )}
    </div>
  );
}
