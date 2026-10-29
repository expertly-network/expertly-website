import Link from 'next/link';
import { MEMBERSHIP_POLICY_URL, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/lib/legal';

const CONTACT_EMAIL = 'contact@growxq.com';

const COLUMNS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: 'Navigation',
    links: [
      { label: 'Articles', href: '/articles' },
      { label: 'Events', href: '/events' },
      { label: 'Members', href: '/members' },
      { label: 'Learnings', href: '/learnings' },
      { label: 'Perks', href: '/perks' },
      { label: 'Templates', href: '/templates' },
      { label: 'Membership', href: '/membership' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Terms & Conditions', href: TERMS_OF_SERVICE_URL },
      { label: 'Membership Policy', href: MEMBERSHIP_POLICY_URL },
      { label: 'Privacy Policy', href: PRIVACY_POLICY_URL },
    ],
  },
  {
    title: 'Social',
    links: [
      {
        label: 'LinkedIn',
        href: 'https://www.linkedin.com/company/expertly-network',
        external: true,
      },
    ],
  },
  {
    title: 'Contact',
    links: [{ label: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}`, external: true }],
  },
];

// Dark band with a soft brand-green glow: link columns on top, an oversized wordmark that runs
// off the bottom edge, then a slim white bar with the copyright line.
export function Footer() {
  return (
    <footer aria-label="Site footer">
      <div className="relative overflow-hidden bg-ink text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_70%_at_12%_110%,color-mix(in_oklab,var(--accent)_45%,transparent),transparent_70%),radial-gradient(50%_60%_at_92%_115%,color-mix(in_oklab,var(--accent)_30%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto w-[min(94%,1760px)] pt-14 sm:pt-16">
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4"
          >
            {COLUMNS.map((col) => (
              <div key={col.title} className="min-w-0">
                <h2 className="font-sans text-sm font-semibold text-white">{col.title}</h2>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.href} className="min-w-0">
                      {link.external ? (
                        <a
                          href={link.href}
                          {...(link.href.startsWith('http')
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                          className="break-words text-[15px] text-white/55 transition-colors hover:text-white"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-[15px] text-white/55 transition-colors hover:text-white"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Oversized wordmark, cropped by the band's bottom edge. Decorative: the brand name is
              already announced by the copyright line below. */}
          <div
            aria-hidden="true"
            className="mt-16 flex select-none items-start justify-center whitespace-nowrap leading-[0.82] sm:mt-24"
          >
            {/* Same shape as <Wordmark>, but each part carries its own gradient fill: background-clip
                text only paints inside an element's own box, so a raised <sup> can't share it. */}
            <span className="-mb-[0.14em] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent)_8%,white)_10%,color-mix(in_oklab,var(--accent)_55%,white)_65%,var(--accent)_100%)] bg-clip-text pb-[0.05em] font-[family-name:var(--font-brand-serif)] text-[min(22vw,400px)] font-semibold tracking-[-0.01em] text-transparent">
              grow
            </span>
            <span className="ml-[0.02em] mt-[0.02em] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--accent)_45%,white),var(--accent))] bg-clip-text font-sans text-[min(8.8vw,160px)] font-semibold tracking-[-0.02em] text-transparent">
              XQ
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-line bg-bg-card">
        <div className="mx-auto flex w-[min(94%,1760px)] flex-wrap items-center justify-between gap-x-6 gap-y-2 py-5 text-sm text-ink-3">
          <p>© {new Date().getFullYear()} GrowXQ · All rights reserved</p>
          <p>Built for finance &amp; legal professionals</p>
        </div>
      </div>
    </footer>
  );
}
