// Red "what changed" rendering shared by the admin member-edit review and the application review:
// the old value is struck through, the new value is shown in red beside it. Unchanged values render
// as plain text so the reviewer's eye lands only on what actually moved.

const OLD_CLASS = 'text-error line-through decoration-error';
const NEW_CLASS = 'rounded bg-[color-mix(in_oklab,var(--error)_8%,transparent)] px-1 font-medium text-error';

export function ChangedValue({
  before,
  after,
  className = '',
}: {
  before: string | null | undefined;
  after: string | null | undefined;
  className?: string;
}) {
  const b = (before ?? '').trim();
  const a = (after ?? '').trim();
  if (a === b) return <span className={className}>{a || '—'}</span>;
  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {b && (
        <span className={OLD_CLASS}>
          <span className="sr-only">Previously: </span>
          {b}
        </span>
      )}
      {b && a && ' '}
      {a ? (
        <span className={NEW_CLASS}>
          <span className="sr-only">Now: </span>
          {a}
        </span>
      ) : (
        <span className="sr-only"> (removed)</span>
      )}
    </span>
  );
}

/** Segment-level variant for ' · '-joined lines: only the segments that differ are marked. */
export function ChangedSegments({ before, after }: { before: string[]; after: string[] }) {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  const removed = before.filter((s) => !afterSet.has(s));
  return (
    <span className="break-words">
      {after.map((seg, i) => (
        <span key={`a-${i}`}>
          {i > 0 && <span className="text-ink-4"> · </span>}
          {beforeSet.has(seg) ? seg : <span className={NEW_CLASS}>{seg}</span>}
        </span>
      ))}
      {removed.map((seg, i) => (
        <span key={`r-${i}`}>
          {(after.length > 0 || i > 0) && <span className="text-ink-4"> · </span>}
          <span className={OLD_CLASS}>{seg}</span>
        </span>
      ))}
    </span>
  );
}
