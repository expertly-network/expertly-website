const STEPS = [
  { num: 1, label: 'LinkedIn Import' },
  { num: 2, label: 'Your Identity' },
  { num: 3, label: 'Background' },
  { num: 4, label: 'Services & Rates' },
  { num: 5, label: 'Review & Submit' },
];

export function WizardSidebar({
  currentStep,
  onStepClick,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
}) {
  return (
    // pt-24 (not py-14's 56px) — clears the page-level absolutely-positioned Logo
    // (top-8/32px + its own line-height), same top-clearance value AuthLayout uses for the
    // same reason on /login.
    <aside className="flex flex-col border-r border-line-2 bg-bg-card px-10 pb-14 pt-24 max-[900px]:border-b max-[900px]:border-r-0 max-[900px]:px-6 max-[900px]:pb-10 max-[900px]:pt-24">
      <span className="text-eyebrow text-ink-3">Membership application</span>
      <h1 className="mt-4 text-headline">
        Let&apos;s build your <em className="font-normal not-italic text-accent">profile.</em>
      </h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-3">
        Complete the questions below. Once approved, this information will display on your public
        directory listing.
      </p>

      <div className="mt-12 flex flex-col gap-1">
        {STEPS.map((step) => {
          const isActive = step.num === currentStep;
          const isDone = step.num < currentStep;
          return (
            <button
              key={step.num}
              type="button"
              onClick={() => isDone && onStepClick(step.num)}
              disabled={!isDone}
              className={`flex items-center gap-3.5 rounded-input px-3.5 py-3 text-sm transition-colors ${
                isActive
                  ? 'bg-bg-alt font-medium text-ink'
                  : isDone
                    ? 'cursor-pointer text-ok hover:bg-bg-alt'
                    : 'cursor-default text-ink-3'
              }`}
            >
              <span
                className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border text-xs ${
                  isActive
                    ? 'border-ink bg-ink text-bg'
                    : isDone
                      ? 'border-ok bg-ok text-white'
                      : 'border-line bg-bg'
                }`}
              >
                {isDone ? '✓' : step.num}
              </span>
              {step.label}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
