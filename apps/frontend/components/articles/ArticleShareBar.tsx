'use client';

import { useState, type ReactNode } from 'react';

// Bare monochrome glyph button shared by the share icons and the PDF download: no chip frame, the
// row reads as quiet article tools.
export const SHARE_ICON_CLASS =
  'flex h-11 w-11 flex-none items-center justify-center rounded-full text-ink transition-colors hover:bg-bg-alt hover:text-ink-3 disabled:cursor-wait disabled:opacity-60';

export function ArticleShareBar({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  /** Extra tool icons (the PDF download) rendered at the end of the same row. */
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  // onClick, not a static href, since the real URL only exists client-side.
  function openShare(network: 'x' | 'linkedin') {
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(title);
    const target =
      network === 'x'
        ? `https://twitter.com/intent/tweet?url=${url}&text=${text}`
        : `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    window.open(target, '_blank', 'noopener,noreferrer');
  }

  async function copyLink() {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (insecure context / permission): nothing useful to show.
    }
  }

  return (
    <div className={`flex flex-none items-center gap-x-4 ${className ?? ''}`}>
      <div className="flex items-center">
        <button type="button" onClick={() => openShare('x')} aria-label="Share on X" className={SHARE_ICON_CLASS}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => openShare('linkedin')}
          aria-label="Share on LinkedIn"
          className={SHARE_ICON_CLASS}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zM7.119 20.452H3.555V9h3.564v11.452z" />
          </svg>
        </button>

        <button type="button" onClick={copyLink} aria-label="Copy link" className={SHARE_ICON_CLASS}>
          {copied ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--ok)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 12l5 5L20 7" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5" />
              <path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07l1.34-1.34" />
            </svg>
          )}
        </button>
        {children}
      </div>
    </div>
  );
}
