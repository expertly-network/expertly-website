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
      { label: 'Articles', href: '/articles' },
      { label: 'Events', href: '/events' },
    ],
  },
  {
    label: 'Resources',
    links: [
      { label: 'Learnings', href: '/learnings' },
      { label: 'Perks', href: '/perks' },
      { label: 'Templates', href: '/templates' },
    ],
  },
  {
    label: 'Company',
    links: [
      { label: 'Membership', href: '/membership' },
      { label: 'Contact us', href: `mailto:${CONTACT_EMAIL}`, external: true },
      { label: 'LinkedIn', href: 'https://www.linkedin.com/company/expertly-network', external: true },
    ],
  },
];

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

// The dark band with the brand-green glow, everything centred: the logo, three link columns, then
// a hairline-separated bar with the legal pages and the copyright line.
export function Footer() {
  return (
    <footer aria-label="Site footer" className="relative overflow-hidden bg-ink text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_15%_120%,color-mix(in_oklab,var(--accent)_35%,transparent),transparent_70%),radial-gradient(50%_80%_at_90%_125%,color-mix(in_oklab,var(--accent)_25%,transparent),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[1520px] px-8 pb-8 pt-16 max-[720px]:px-5 max-[720px]:pt-12">
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
          <nav aria-label="Legal">
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <FooterAnchor link={link} className="text-xs text-white/50 transition-colors hover:text-white" />
                </li>
              ))}
            </ul>
          </nav>
          <p className="font-mono text-xs tracking-[0.06em] text-white/35">
            © {new Date().getFullYear()} GrowXQ · All rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
