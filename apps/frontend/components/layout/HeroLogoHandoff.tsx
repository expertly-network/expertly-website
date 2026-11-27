'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { LogoImage } from '@/components/Logo';

// Desktop: the hero carries the logo until the visitor scrolls. Every width: toggles
// `page-scrolled` on <html>, which clips the mobile top bar's homepage logo to its mark.
export function HeroLogoHandoff() {
  const pathname = usePathname();

  useEffect(() => {
    const update = () => {
      document.documentElement.classList.toggle('page-scrolled', window.scrollY >= 24);
      document.documentElement.classList.toggle(
        'in-hero',
        !!document.getElementById('hero-stellar') && window.scrollY < 24
      );
    };

    // The homepage hero can stream in after the shell mounts.
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', update, { passive: true });
    update();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
      document.documentElement.classList.remove('in-hero', 'page-scrolled');
    };
  }, [pathname]);

  return (
    <Link
      href="/"
      aria-label="GrowXQ home"
      className="hero-logo-handoff fixed left-[15px] top-5 z-[75] hidden items-center min-[1024px]:inline-flex"
    >
      <LogoImage surface="dark" height={26} priority />
    </Link>
  );
}
