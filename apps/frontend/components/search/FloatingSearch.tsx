'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SearchModal } from '@/components/home/SearchModal';
import type { SearchScope } from '@shared/search';

// Pages where a fixed bottom bar would clash with the page's own UI (forms, editors, the member
// profile's mobile action bar, admin tables).
const HIDDEN_PREFIXES = ['/admin', '/apply', '/articles/write', '/login', '/signup', '/onboarding'];

// The floating "Ask GrowXQ" launcher from the design prototype (design/static_html/assets/
// home.css `.floating-search`): a dark pill at the bottom centre that appears once the visitor has
// scrolled past the hero, hides near the footer, and opens the AI search modal. ⌘K / Ctrl+K opens
// it from anywhere. On Articles, Events and Members it searches just that section.
export function FloatingSearch() {
  const pathname = usePathname() ?? '/';
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const hidden = HIDDEN_PREFIXES.some((p) => pathname.startsWith(p)) || /^\/members\/[^/]+/.test(pathname);

  const scope: SearchScope = pathname.startsWith('/articles')
    ? 'articles'
    : pathname.startsWith('/events')
      ? 'events'
      : pathname.startsWith('/members')
        ? 'members'
        : 'all';
  const label =
    scope === 'articles'
      ? 'Ask about articles'
      : scope === 'events'
        ? 'Find events'
        : scope === 'members'
          ? 'Find an expert'
          : 'Search experts, articles & events';

  useEffect(() => {
    if (hidden) return;
    const footer = document.querySelector('footer[aria-label="Site footer"]');
    const onScroll = () => {
      const nearFooter = !!footer && footer.getBoundingClientRect().top < window.innerHeight - 16;
      setVisible(window.scrollY > 620 && !nearFooter);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [hidden, pathname]);

  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hidden]);

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        tabIndex={visible && !open ? 0 : -1}
        aria-hidden={!visible || open}
        className={`fixed bottom-6 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink py-3 pl-[18px] pr-3.5 text-white shadow-[0_18px_44px_-16px_rgba(0,0,0,0.5)] transition-[opacity,visibility,bottom] duration-200 hover:bottom-[27px] min-[1024px]:ml-7 ${
          visible && !open ? 'visible opacity-100' : 'pointer-events-none invisible opacity-0'
        }`}
      >
        <span aria-hidden="true" className="text-[15px] text-accent">
          ✦
        </span>
        <span className="text-sm font-medium tracking-[-0.01em] max-[560px]:hidden">{label}</span>
        <span className="rounded-[7px] bg-white/10 px-2 py-1 font-mono text-[11px] text-white/70 max-[560px]:hidden">
          ⌘K
        </span>
      </button>
      <SearchModal open={open} onClose={() => setOpen(false)} scope={scope} />
    </>
  );
}
