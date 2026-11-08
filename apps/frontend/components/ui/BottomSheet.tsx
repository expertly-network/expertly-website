'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// A panel that slides up from the bottom of the screen over a dimmed page — the phone pattern for
// filters and other short, focused tasks. Built on a native <dialog> (focus trap, Escape, focus
// restore) like SideDrawer. `title` sits in a fixed header with a close button; `footer` stays
// pinned to the bottom while the body scrolls. Mount it only while open.
export function BottomSheet({
  title,
  onClose,
  footer,
  children,
}: {
  title: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

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
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 flex max-h-[88dvh] w-full max-w-none animate-[sheetUp_0.35s_cubic-bezier(0.22,1,0.36,1)] flex-col rounded-t-3xl border-t border-line bg-bg-card p-0 text-ink shadow-[0_-24px_60px_-20px_rgba(0,0,0,0.3)] backdrop:bg-[rgba(11,11,12,0.4)] backdrop:backdrop-blur-[3px] motion-reduce:animate-none"
    >
      <div className="flex flex-none items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-title text-ink">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-2 flex h-11 w-11 items-center justify-center text-ink-3 hover:text-ink"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer && (
        <div className="flex flex-none gap-2.5 border-t border-line bg-bg-card px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4">
          {footer}
        </div>
      )}
    </dialog>
  );
}
