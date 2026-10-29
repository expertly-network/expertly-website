import { toTextBlocks } from '@/lib/text/text-blocks';

// Renders free-form multi-line text (bios pasted from LinkedIn, etc.) as real paragraphs and
// bullet lists instead of one pre-wrapped blob: every line is its own spaced paragraph (LinkedIn's
// "About" separates paragraphs with a single line break, not a blank line), and lines starting
// with "-", "•", "*" or "–" become list items.
export function FormattedText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = toTextBlocks(text);
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
