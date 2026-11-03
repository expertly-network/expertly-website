import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

export function StepActions({
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled,
  backHidden,
  leftSlot,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  backHidden?: boolean;
  /** Rendered in the back button's place when backHidden is true — e.g. a "Skip" link. */
  leftSlot?: ReactNode;
}) {
  return (
    <div className="mt-9 flex items-center justify-between gap-3 border-t border-line pt-6 max-[900px]:fixed max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-20 max-[900px]:mt-0 max-[900px]:bg-bg-card max-[900px]:px-5 max-[900px]:pt-3 max-[900px]:pb-[calc(12px+env(safe-area-inset-bottom))]">
      {!backHidden ? (
        <Button variant="secondary" onClick={onBack} className="max-[900px]:px-4">
          ← Back
        </Button>
      ) : (
        (leftSlot ?? <span />)
      )}
      {onNext && (
        <Button onClick={onNext} disabled={nextDisabled} className="max-[900px]:flex-1 max-[900px]:px-4">
          {nextLabel} <span aria-hidden="true">→</span>
        </Button>
      )}
    </div>
  );
}
