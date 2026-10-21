'use client';

import { useState } from 'react';

// Dismissible confirmation banner — the success-tinted counterpart to ErrorBanner, for one-shot
// "it worked" messages after a redirect (e.g. ?saved=draft).
export function SuccessNotice({ message }: { message: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-[10px] border border-[color-mix(in_oklab,var(--ok)_30%,transparent)] bg-[color-mix(in_oklab,var(--ok)_8%,transparent)] px-3.5 py-3 text-sm text-ok"
    >
      <span>{message}</span>
      <button type="button" aria-label="Dismiss" onClick={() => setOpen(false)} className="opacity-70 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}
