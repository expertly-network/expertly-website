'use client';

import { useState } from 'react';
import type { ArticleDto } from '@shared/article';
import { SHARE_ICON_CLASS } from '@/components/articles/ArticleShareBar';

type PdfState = 'idle' | 'generating' | 'error';

// The PDF icon beside the share icons: downloads the article as a branded PDF (same look as the member
// profile PDF). Only rendered when the reader has the full body — signed-out visitors only get
// the excerpt, so their PDF would be empty.
export function ArticleDownloadButton({ article }: { article: ArticleDto }) {
  const [state, setState] = useState<PdfState>('idle');

  async function download() {
    setState('generating');
    try {
      // Loaded on demand so @react-pdf/renderer (~500 KB) never ships with the page itself.
      const { downloadArticlePdf } = await import('@/components/articles/pdf/downloadArticlePdf');
      await downloadArticlePdf(article);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={state === 'generating'}
      title={state === 'error' ? 'Could not generate the PDF — click to try again' : 'Download article as PDF'}
      aria-label={state === 'error' ? 'Retry PDF download' : 'Download article as PDF'}
      className={`${SHARE_ICON_CLASS} ${state === 'error' ? 'text-error' : ''}`}
    >
      {state === 'generating' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      )}
    </button>
  );
}
