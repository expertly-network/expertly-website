'use client';
import { useEffect, useRef, useId, type ReactNode } from 'react';
import { Button } from '@/components/ui';
// Native dialog provides focus trapping, Escape and focus restoration for resource details/player.
export function ResourceDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-card border border-line bg-bg-card p-0 text-ink shadow-xl backdrop:bg-black/60"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-line bg-bg-card px-5 py-3">
        <h2 id={titleId} className="text-title">
          {title}
        </h2>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          aria-label="Close dialog"
        >
          Close ×
        </Button>
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </dialog>
  );
}
