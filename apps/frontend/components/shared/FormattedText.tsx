import { toTextBlocks, type TextBlock } from '@/lib/text/text-blocks';

// Renders free-form multi-line text (bios pasted from LinkedIn, etc.) as real paragraphs and
// bullet lists instead of one pre-wrapped blob: every line is its own spaced paragraph (LinkedIn's
// "About" separates paragraphs with a single line break, not a blank line), and lines starting
// with "-", "•", "*" or "–" become list items.
/** How many paragraphs and bullets `text` has — what `maxItems` counts. */
export function countTextItems(text: string): number {
  return toTextBlocks(text).reduce((n, b) => n + (b.kind === 'ul' ? b.items.length : 1), 0);
}

// `maxItems` shows only the first N paragraphs / bullets, each one whole (never a clipped line).
export function FormattedText({
  text,
  className = '',
  maxItems,
}: {
  text: string;
  className?: string;
  maxItems?: number;
}) {
  let blocks = toTextBlocks(text);
  if (maxItems !== undefined) {
    let left = maxItems;
    blocks = blocks.flatMap((block): TextBlock[] => {
      if (left <= 0) return [];
      if (block.kind === 'p') {
        left -= 1;
        return [block];
      }
      const items = block.items.slice(0, left);
      left -= items.length;
      return [{ ...block, items }];
    });
  }
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
