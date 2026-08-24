// Matches design/static_html/apply.html's .apply-progress / .apply-progress-bar exactly — a
// single continuous track with an animated-width fill, not a segmented indicator.
export function WizardProgress({
  currentStep,
  totalSteps,
  saving,
}: {
  currentStep: number;
  totalSteps: number;
  saving?: boolean;
}) {
  const pct = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-10">
      <div className="relative h-[3px] rounded-full bg-line">
        <div
          className="absolute left-0 top-0 h-[3px] rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between text-mono-label text-ink-3">
        <span>
          STEP {currentStep} OF {totalSteps}
        </span>
        {saving && (
          <span className="flex items-center gap-1.5 normal-case tracking-normal text-ink-3">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Saving…
          </span>
        )}
      </div>
    </div>
  );
}
