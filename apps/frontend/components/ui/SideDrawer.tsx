'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// A panel that slides in from the right over a dimmed page. Built on a native <dialog> (focus
// trap, Escape, focus restore), styled as a full-height drawer — full width on phones.
// `footer` stays pinned to the bottom while the body scrolls.
export function SideDrawer({
  label,
  onClose,
  footer,
  children,
}: {
  /** Accessible name for the drawer. */
  label: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // New content (e.g. stepping to the next item) starts at the top.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [label]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="fixed inset-y-0 left-auto right-0 m-0 flex h-dvh max-h-dvh w-full max-w-[520px] animate-[drawerIn_0.4s_cubic-bezier(0.22,1,0.36,1)] flex-col border-l border-line bg-bg-card p-0 text-ink shadow-[-30px_0_70px_-24px_rgba(0,0,0,0.3)] backdrop:bg-[rgba(11,11,12,0.4)] backdrop:backdrop-blur-[3px] motion-reduce:animate-none"
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {children}
      </div>
      {footer && <div className="flex gap-2.5 border-t border-line bg-bg-card px-5 py-4 sm:px-7">{footer}</div>}
    </dialog>
  );
}
