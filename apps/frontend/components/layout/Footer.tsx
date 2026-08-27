import Link from 'next/link';

// Matches design/static_html's real footer content — populated at runtime by
// `assets/shared.js`'s `renderFooter()` into the otherwise-empty `<footer class="footer--
// minimal">` tag (a past pass here missed this: reading the static HTML alone shows nothing,
// the content only exists via that JS). `nav-green` is correct here — confirmed against
// `theme.css`'s `.footer--minimal { background: var(--nav-green) }`, contradicting an earlier
// assumption in this codebase that the token wasn't used anywhere real.
//
// The design's footer is normally `position: fixed` (a parallax reveal-at-bottom-of-scroll
// effect), but its OWN CSS (`dashboard-shell.css`) explicitly overrides that to a plain
// static in-flow footer specifically for every page using the sidebar shell (`.d1-shell`) —
// which is every page in this app. Implemented as static-only here; the fixed/parallax
// variant is dead code for this app, not a corner cut.
const PRIMARY_LINKS = [
  { label: 'Expertly', href: '/' },
  { label: 'Articles', href: '/articles' },
  { label: 'Events', href: '/events' },
  { label: 'Benefits', href: '/membership' },
  { label: 'Members', href: '/members' },
];

export function Footer() {
  return (
    <footer className="bg-nav-green px-6 py-16 max-[600px]:pb-14 max-[600px]:pt-10" aria-label="Site footer">
      <div className="mx-auto flex max-w-[720px] flex-col items-center gap-7 text-center">
        <div className="inline-flex items-baseline text-[56px] font-semibold leading-none tracking-[-0.03em] text-white max-[600px]:text-[40px]">
          Expertly
          <span aria-hidden="true" className="ml-0.5 h-[11px] w-[11px] translate-y-[-4px] rounded-full bg-accent-2" />
        </div>

        <nav aria-label="Site links">
          <ul className="flex flex-wrap items-center justify-center gap-9 max-[600px]:gap-5">
            {PRIMARY_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-[15px] font-semibold tracking-[-0.005em] text-white/[0.82] transition-colors hover:text-accent-2"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Footer links">
          <ul className="flex flex-wrap items-center justify-center gap-9 max-[600px]:gap-5">
            <li>
              <a
                href="https://www.linkedin.com/company/expertly-network"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] tracking-[-0.005em] text-white/[0.58] transition-colors hover:text-white"
              >
                LinkedIn
              </a>
            </li>
            {/* Terms & Conditions / Membership Policy / Privacy Policy are `href="#"`
                placeholders in the design itself too — not real pages yet, so these are
                plain (non-navigating) text rather than a fake link that jump-scrolls on
                click. */}
            {['Terms & Conditions', 'Membership Policy', 'Privacy Policy'].map((label) => (
              <li key={label}>
                <span className="cursor-default text-[15px] tracking-[-0.005em] text-white/[0.58]">
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </nav>

        <p className="font-mono text-[11px] tracking-[0.08em] text-white/[0.28]">
          © {new Date().getFullYear()} Expertly · All Rights Reserved
        </p>
      </div>
    </footer>
  );
}
