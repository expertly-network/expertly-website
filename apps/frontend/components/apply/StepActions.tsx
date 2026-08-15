import { Button } from '@/components/ui/Button';

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
        <Button variant="secondary" onClick={onBack}>
          ← Back
        </Button>
      ) : (
        <span />
      )}
      {onNext && (
        <Button onClick={onNext} disabled={nextDisabled}>
          {nextLabel} <span aria-hidden="true">→</span>
        </Button>
      )}
    </div>
  );
}
