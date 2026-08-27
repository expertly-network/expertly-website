'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui';

// Compact sidebar variant of components/home/Newsletter.tsx's pattern — same "not live yet"
// honesty on submit (see that file's note: newsletter subscriptions are 📋 roadmap, no
// backend), different copy/size matching design/static_html/article.html's sidebar box
// rather than reusing the home page's full-width card.
export function ArticleNewsletterCard() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <Card padding="md" className="relative overflow-hidden bg-ink">
      {/* Matches design's `.art-newsletter::before` — a soft accent-tinted circle bleeding off
          the top-right corner. Every other dark card in this codebase (AuthRightPanel, etc.)
          uses this same radial-gradient-over-flat-`--ink` technique — this card was previously
          missing it, rendering as flat near-black instead. */}
      <div
        className="pointer-events-none absolute -right-11 -top-11 h-[220px] w-[220px] rounded-full"
        style={{
          background: 'radial-gradient(circle, color-mix(in oklab, var(--accent) 24%, transparent) 0%, transparent 70%)',
        }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="mb-1 text-mono-label text-white/50">Weekly briefing</div>
        <h3 className="mt-2 text-title text-bg-card">
          Get the next one before your clients do.
        </h3>
        <p className="mt-2 text-xs text-white/60">
          One email a week — the regulatory changes, rulings, and deal structures Expertly&apos;s
          verified practitioners are actually discussing.
        </p>
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <label htmlFor="article-newsletter-email" className="sr-only">
            Email address
          </label>
          <input
            id="article-newsletter-email"
            type="email"
            placeholder="you@firm.com"
            required
            className="w-full rounded-input border border-white/20 bg-white/10 px-3.5 py-3 text-sm text-bg placeholder:text-white/40"
          />
          <Button type="submit" variant="secondary-dark" fullWidth>
            Subscribe →
          </Button>
        </form>
        {submitted && (
          <p className="mt-3 text-xs text-white/60" role="status">
            Newsletter subscriptions aren&apos;t live yet — check back soon.
          </p>
        )}
        <p className="mt-3 text-xs text-white/40">No spam. Unsubscribe anytime.</p>
      </div>
    </Card>
  );
}
