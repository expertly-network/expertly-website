'use client';

import { useEffect } from 'react';

// Crossfades the sidebar's collapsed logo mark with a floating wordmark while a stellar hero
// is in view. Safe on any page — if no #hero-stellar element exists, this is a no-op.
export function HeroLogoHandoff() {
  useEffect(() => {
    let intersectionObserver: IntersectionObserver | null = null;

    // A MutationObserver waits for #hero-stellar to stream in, since it may not exist at mount.
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
