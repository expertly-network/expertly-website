'use client';

import { useEffect } from 'react';

const MESSAGE = 'You have unsaved changes. Leave this page and lose them?';

// Warns before an edit in progress is thrown away: browser-level navigation (refresh, tab close,
// typed URL) via `beforeunload`, and in-app link clicks (Next <Link>s like "← Back to article")
// via a capture-phase click listener, since the App Router has no route-change event to cancel.
// `confirmLeave()` is for the page's own buttons that navigate programmatically.
export function useUnsavedChangesGuard(dirty: boolean): { confirmLeave: () => boolean } {
  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = ''; // required by Chrome to show the native prompt
    }

    function onClickCapture(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return; // full navigation -> beforeunload handles it
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [dirty]);

  return { confirmLeave: () => !dirty || window.confirm(MESSAGE) };
}
