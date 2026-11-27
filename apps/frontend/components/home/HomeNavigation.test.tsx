// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const route = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
vi.mock('./SearchModal', () => ({ SearchModal: () => null }));
import { FloatingSearch } from '@/components/search/FloatingSearch';
import { Faq } from '@/components/faq/Faq';

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  route.pathname = '/';
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe('home page navigation', () => {
  it('shows search only while scrolling up past the hero, and hides it at the footer', async () => {
    const hero = document.createElement('section');
    hero.id = 'hero-stellar';
    const footer = document.createElement('footer');
    footer.setAttribute('aria-label', 'Site footer');
    document.body.append(hero, footer);
    let heroBottom = 100;
    let footerTop = 2000;
    vi.spyOn(hero, 'getBoundingClientRect').mockImplementation(() => ({ bottom: heroBottom }) as DOMRect);
    vi.spyOn(footer, 'getBoundingClientRect').mockImplementation(() => ({ top: footerTop }) as DOMRect);
    vi.stubGlobal('scrollY', 1000);
    await act(async () => root.render(<FloatingSearch />));
    const launcher = host.querySelector('button')!;
    expect(launcher.getAttribute('aria-hidden')).toBe('true');
    heroBottom = -1;
    const scrollTo = async (y: number) => {
      vi.stubGlobal('scrollY', y);
      await act(async () => window.dispatchEvent(new Event('scroll')));
    };
    await scrollTo(1200); // scrolling down past the hero: stays hidden
    expect(launcher.getAttribute('aria-hidden')).toBe('true');
    await scrollTo(1100); // scrolling up: appears
    expect(launcher.getAttribute('aria-hidden')).toBe('false');
    await scrollTo(1300); // down again: tucks away
    expect(launcher.getAttribute('aria-hidden')).toBe('true');
    await scrollTo(1200);
    expect(launcher.getAttribute('aria-hidden')).toBe('false');
    footerTop = 100;
    await act(async () => window.dispatchEvent(new Event('scroll')));
    expect(launcher.getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the 620px threshold on other pages, shown on scroll up', async () => {
    route.pathname = '/members';
    vi.stubGlobal('scrollY', 900);
    await act(async () => root.render(<FloatingSearch />));
    expect(host.querySelector('button')?.getAttribute('aria-hidden')).toBe('true');
    vi.stubGlobal('scrollY', 621);
    await act(async () => window.dispatchEvent(new Event('scroll')));
    expect(host.querySelector('button')?.getAttribute('aria-hidden')).toBe('false');
    expect(host.textContent).not.toContain('Ask GrowXQ');
  });

  it('switches FAQ audiences and keeps the selected questions expandable', async () => {
    await act(async () =>
      root.render(
        <Faq
          membership={[{ q: 'How to join?', a: 'Apply online.' }]}
          clients={[{ q: 'How to browse?', a: 'Open the directory.' }]}
        />
      )
    );
    const findButton = (text: string) =>
      [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === text)!;
    expect(findButton('Membership').getAttribute('aria-pressed')).toBe('true');
    await act(async () => findButton('For clients').click());
    expect(findButton('For clients').getAttribute('aria-pressed')).toBe('true');
    expect(findButton('Membership').getAttribute('aria-pressed')).toBe('false');
    const question = [...host.querySelectorAll('button')].find((b) => b.textContent?.includes('How to browse?'))!;
    await act(async () => question.click());
    expect(question.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(question.getAttribute('aria-controls')!)?.textContent).toBe('Open the directory.');
  });
});
