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
    <div className="mt-9 flex items-center justify-between border-t border-line pt-6">
      {!backHidden ? (
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
      ) : (
        leftSlot ?? <span />
      )}
      {onNext && (
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextLabel} <span aria-hidden="true">→</span>
        </Button>
      )}
    </div>
  );
}
