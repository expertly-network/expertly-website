import Link from 'next/link';
import { LogoImage } from '@/components/Logo';
import { PRIVACY_POLICY_URL, USER_AGREEMENT_URL } from '@/lib/consent';

const CONTACT_EMAIL = 'ask@growxq.com';

type FooterLink = { label: string; href: string; external?: boolean };

// Three labelled columns of site links, then a bottom bar with the legal pages and copyright.
const LINK_GROUPS: { label: string; links: FooterLink[] }[] = [
  {
    label: 'Explore',
    links: [
      { label: 'Members', href: '/members' },
      { label: 'Library', href: '/articles' },
      { label: 'Events', href: '/events' },
    ],
  },
  {
    label: 'Resources',
    links: [
      { label: 'Technology', href: '/learnings' },
      { label: 'Tools', href: '/perks' },
    ],
  },
  {
    label: 'Company',
    links: [
      { label: 'Membership', href: '/membership' },
      { label: 'FAQ', href: '/faq' },
      { label: 'Contact us', href: `mailto:${CONTACT_EMAIL}`, external: true },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/company/expertly-network', external: true },
    ],
  },
];

// Desktop's single row of pages: the Explore and Resources links.
const DESKTOP_PAGE_LINKS: FooterLink[] = LINK_GROUPS.filter((g) => g.label !== 'Company').flatMap((g) => g.links);

// Desktop's second line: FAQ, then the legal pages.
const FAQ_LINK: FooterLink = { label: 'FAQ', href: '/faq' };

const LEGAL_LINKS: FooterLink[] = [
  { label: 'User & Member Policy', href: USER_AGREEMENT_URL },
  { label: 'Privacy Policy', href: PRIVACY_POLICY_URL },
];

function FooterAnchor({ link, className }: { link: FooterLink; className: string }) {
  return link.external ? (
    <a
      href={link.href}
      {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={className}
    >
      {link.label}
    </a>
  ) : (
    <Link href={link.href} className={className}>
      {link.label}
    </Link>
  );
}

function Copyright() {
  return (
    <p className="font-mono text-xs tracking-[0.06em] text-white/35">
      © {new Date().getFullYear()} GrowXQ · All rights reserved
    </p>
  );
}

function LegalLinks({
  className,
  linkClassName = 'text-xs text-white/50 transition-colors hover:text-white',
  leading = [],
}: {
  className: string;
  linkClassName?: string;
  /** Links shown before the legal pages on the same line (desktop puts FAQ here). */
  leading?: FooterLink[];
}) {
  return (
    <nav aria-label="Legal">
      <ul className={className}>
        {[...leading, ...LEGAL_LINKS].map((link) => (
          <li key={link.href}>
            <FooterAnchor link={link} className={linkClassName} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

// The dark band with the brand-green glow. Phones and tablets: everything centred (the logo, three
// link columns, then a hairline-separated bar with the legal pages and the copyright line).
// Desktop: two centred lines (the site pages, then FAQ and the legal pages), and a giant
// GrowXQ wordmark in the logo's colours, shown in full, on plain ink (no glow). The two
// layouts are separate blocks (lg:hidden / hidden lg:block) rather than one grid with overrides.
export function Footer() {
  return (
    <footer aria-label="Site footer" className="relative overflow-hidden bg-ink text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 lg:hidden bg-[radial-gradient(60%_90%_at_15%_120%,color-mix(in_oklab,var(--accent)_35%,transparent),transparent_70%),radial-gradient(50%_80%_at_90%_125%,color-mix(in_oklab,var(--accent)_25%,transparent),transparent_70%)]"
      />

      {/* Phones and tablets. */}
      <div className="relative mx-auto max-w-[1520px] px-8 pb-8 pt-16 max-[720px]:px-5 max-[720px]:pt-12 lg:hidden">
        <div className="flex flex-col items-center gap-10">
          <Link href="/" aria-label="GrowXQ home" className="inline-block select-none">
            <LogoImage surface="dark" height={44} className="max-[600px]:![--logo-h:34px]" />
          </Link>

          <div className="grid w-full max-w-[560px] grid-cols-3 gap-x-4 text-center">
            {LINK_GROUPS.map((group) => (
              <nav key={group.label} aria-label={group.label}>
                <h2 className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/40">{group.label}</h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <FooterAnchor
                        link={link}
                        className="text-sm text-white/80 transition-colors hover:text-accent-2"
                      />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 border-t border-white/10 pt-6 text-center">
          <LegalLinks className="flex flex-wrap justify-center gap-x-5 gap-y-2" />
          <Copyright />
        </div>
      </div>

      {/* Desktop. */}
      <div className="relative mx-auto hidden w-[min(94%,1760px)] pt-24 [container-type:inline-size] lg:block">
        {/* Two centred lines: the site pages, then the legal pages. (Desktop has no copyright line.) */}
        <nav aria-label="Site pages">
          <ul className="flex flex-wrap justify-center gap-x-10 gap-y-3">
            {DESKTOP_PAGE_LINKS.map((link) => (
              <li key={link.href}>
                <FooterAnchor link={link} className="text-lg text-white/55 transition-colors hover:text-accent" />
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-6 flex justify-center">
          {/* Same size and colour as line 1. */}
          <LegalLinks
            className="flex gap-x-10"
            linkClassName="text-lg text-white/55 transition-colors hover:text-accent"
            leading={[FAQ_LINK]}
          />
        </div>

        {/* The wordmark in the logo's colours (Grow white, XQ brand green), shown in full: the bottom
            padding leaves room for the Q's tail. About 64% of the full-width size (12.7cqw, max 224px), with space above. */}
        <Link
          href="/"
          aria-label="GrowXQ home"
          className="relative mt-20 block select-none pb-[0.3em] text-[min(12.7cqw,224px)]"
        >
          <span
            aria-hidden="true"
            className="font-brand relative block whitespace-nowrap text-center leading-[0.8] tracking-[-0.03em] text-white"
          >
            Grow<span className="text-accent">XQ</span>
          </span>
        </Link>
      </div>
    </footer>
  );
}
