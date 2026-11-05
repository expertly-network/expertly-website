import { Logo } from '@/components/Logo';

export const WIZARD_STEPS = [
  { num: 1, label: 'Import Profile' },
  { num: 2, label: 'Personal Details' },
  { num: 3, label: 'Experience' },
  { num: 4, label: 'Services' },
  { num: 5, label: 'Review' },
];

export function WizardSidebar({
  currentStep,
  onStepClick,
  saving = false,
  previewMode = false,
}: {
  currentStep: number;
  saving?: boolean;
  previewMode?: boolean;
  onStepClick: (step: number) => void;
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-10 flex w-[360px] flex-col overflow-y-auto overscroll-contain border-r border-line-2 bg-bg-card px-10 pb-14 pt-24 max-[900px]:hidden">
      <Logo variant="auth" className="absolute left-8 top-8" />
      <span className="text-eyebrow text-ink-3">Membership application</span>
      <h1 className="mt-4 text-headline">
        Let&apos;s build your <em className="font-normal not-italic text-accent">profile.</em>
      </h1>
      <p className="mt-4 text-lede text-ink-3">
        Complete the questions. Once approved, this information will display on your profile.
      </p>

      <div className="mt-12 flex flex-col gap-1">
        {WIZARD_STEPS.map((step) => {
          const isActive = step.num === currentStep;
          const isDone = step.num < currentStep;
          return (
            <button
              key={step.num}
              type="button"
              onClick={() => onStepClick(step.num)}
              disabled={saving || (!previewMode && !isDone)}
              aria-current={isActive ? 'step' : undefined}
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
                  isActive ? 'border-ink bg-ink text-bg' : isDone ? 'border-ok bg-ok text-white' : 'border-line bg-bg'
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
