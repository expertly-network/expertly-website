'use client';

import { useState } from 'react';

// Real share-URL-based sharing, matching design/static_html/article.html's `.art-share-chip`
// row — icons ported verbatim (brand-colored LinkedIn/Reddit SVGs, Quora's own glyph tile, a
// link/checkmark swap for copy) rather than the placeholder "in"/"r/"/🔗 text this previously
// showed, which is what the "icons aren't appropriate" feedback was about.
export function ArticleShareBar({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  function shareUrl(network: 'linkedin' | 'reddit' | 'quora'): string {
    if (typeof window === 'undefined') return '#';
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(title);
    if (network === 'linkedin') return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    if (network === 'reddit') return `https://www.reddit.com/submit?url=${url}&title=${text}`;
    return `https://www.quora.com/share?url=${url}&title=${text}`;
  }

  async function copyLink() {
    if (typeof window === 'undefined') return;
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  const chipClass =
    'flex h-10 w-10 flex-none items-center justify-center rounded-[10px] border border-line bg-bg-card text-ink-3 transition-[border-color,transform,box-shadow] hover:-translate-y-px hover:border-ink hover:shadow-[0_8px_18px_-12px_rgba(0,0,0,0.35)]';

  return (
    <div className="flex flex-none items-center gap-2">
      <a
        href={shareUrl('linkedin')}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        className={chipClass}
      >
        <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
          <rect width="24" height="24" rx="5" fill="#0A66C2" />
          <path
            fill="#fff"
            d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zM7.119 20.452H3.555V9h3.564v11.452z"
          />
        </svg>
      </a>
      <a
        href={shareUrl('reddit')}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Reddit"
        className={chipClass}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF4500" aria-hidden="true">
          <path d="M12 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 01-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.11 3.11 0 01.042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 013.53 12.53c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 01.14-.197.35.35 0 01.238-.042l2.906.617a1.214 1.214 0 011.108-.727zM9.25 12c-.689 0-1.25.562-1.25 1.25 0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 00-.231.094.33.33 0 000 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 00.029-.463.33.33 0 00-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 00-.232-.095z" />
        </svg>
      </a>
      <a
        href={shareUrl('quora')}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Quora"
        className={chipClass}
      >
        <span className="flex h-[21px] w-[21px] flex-none items-center justify-center rounded-[5px] bg-[#B92B27] font-sans text-[13px] font-bold text-white">
          Q
        </span>
      </a>
      <button type="button" onClick={copyLink} aria-label="Copy link" className={chipClass}>
        {copied ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12l5 5L20 7" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 007.07 0l2.83-2.83a5 5 0 00-7.07-7.07L11.5 4.5" />
            <path d="M14 11a5 5 0 00-7.07 0L4.1 13.83a5 5 0 007.07 7.07l1.34-1.34" />
          </svg>
        )}
      </button>
    </div>
  );
}
