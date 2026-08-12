export function StepActions({
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled,
  backHidden,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  backHidden?: boolean;
}) {
  return (
    <div className="mt-9 flex items-center justify-between border-t border-line pt-6">
      {!backHidden ? (
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-[48px] items-center rounded-input border border-line-2 px-6 text-sm font-medium text-ink transition-colors hover:border-ink"
        >
          ← Back
        </button>
      ) : (
        <span />
      )}
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="flex min-h-[48px] items-center gap-2 rounded-input bg-ink px-6 text-sm font-medium text-bg transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {nextLabel} <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
