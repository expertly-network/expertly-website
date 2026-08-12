export function WizardProgress({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  const pct = (currentStep / totalSteps) * 100;

  return (
    <div className="mb-10">
      <div className="h-[3px] rounded-full bg-line">
        <div
          className="h-[3px] rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-3 text-mono-label text-ink-3">
        STEP {currentStep} OF {totalSteps}
      </div>
    </div>
  );
}
