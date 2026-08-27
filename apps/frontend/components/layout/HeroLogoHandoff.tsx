'use client';

import { useEffect } from 'react';

// Ported from design/static_html/index.html's own inline script (~line 1513, "Dark nav +
// sidebar wordmark handoff while stellar hero is visible"): while a page's stellar hero
// (StellarOrbitHero, id="hero-stellar") is in view, the sidebar's own collapsed "E" mark
// hides (see globals.css's `html.in-hero` rules) and this component's fixed-position
// "Expertly." wordmark takes its place over the dark hero instead — a straight opacity
// crossfade with zero position jump, per the source's own comment. Safe to render on every
// page: if no #hero-stellar element ever appears, `in-hero` never gets set, so the sidebar's
// normal logo just stays visible as-is.
export function HeroLogoHandoff() {
  useEffect(() => {
    let intersectionObserver: IntersectionObserver | null = null;

    // AppShell renders this component outside of the route's streamed {children} — on first
    // paint, (shell)/loading.tsx's skeleton is in the DOM instead of the real page, so
    // #hero-stellar doesn't exist yet at mount time. A MutationObserver picks it up the
    // moment the real content streams in and replaces the skeleton (this effect has no
    // dependency to react to otherwise, since it only runs once on mount).
    function attach(heroSection: Element) {
      intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          document.documentElement.classList.toggle('in-hero', entry.isIntersecting);
        },
        { threshold: 0, rootMargin: '0px 0px -15% 0px' }
      );
      intersectionObserver.observe(heroSection);
    }

    const existing = document.getElementById('hero-stellar');
    if (existing) {
      attach(existing);
      return () => {
        intersectionObserver?.disconnect();
        document.documentElement.classList.remove('in-hero');
      };
    }

    const mutationObserver = new MutationObserver(() => {
      const heroSection = document.getElementById('hero-stellar');
      if (heroSection) {
        mutationObserver.disconnect();
        attach(heroSection);
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      intersectionObserver?.disconnect();
      document.documentElement.classList.remove('in-hero');
    };
  }, []);

  return (
    <a
      href="/"
      aria-label="Expertly home"
      className="hero-logo-handoff fixed left-6 top-7 z-[75] inline-flex items-baseline gap-0 text-[20px] font-semibold tracking-[-0.02em] text-bg-card"
    >
      Expertly
      <span className="ml-px mb-px h-1.5 w-1.5 flex-none rounded-full bg-accent-2" />
    </a>
  );
}
