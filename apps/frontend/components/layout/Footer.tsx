import Link from 'next/link';
import { LogoImage } from '@/components/Logo';
import { MEMBERSHIP_POLICY_URL } from '@/lib/legal';
import { PRIVACY_POLICY_URL, USER_AGREEMENT_URL } from '@/lib/consent';

const CONTACT_EMAIL = 'ask@growxq.com';

type FooterLink = { label: string; href: string; external?: boolean };

// Three centred rows: the main pages, the legal pages, then contact and social.
const PAGE_LINKS: FooterLink[] = [
  { label: 'Articles', href: '/articles' },
  { label: 'Events', href: '/events' },
  { label: 'Members', href: '/members' },
  { label: 'Learnings', href: '/learnings' },
  { label: 'Perks', href: '/perks' },
  { label: 'Templates', href: '/templates' },
  { label: 'Membership', href: '/membership' },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: 'User Agreement', href: USER_AGREEMENT_URL },
  { label: 'Membership Policy', href: MEMBERSHIP_POLICY_URL },
  { label: 'Privacy Policy', href: PRIVACY_POLICY_URL },
];

const CONTACT_LINKS: FooterLink[] = [
  { label: 'Contact us', href: `mailto:${CONTACT_EMAIL}`, external: true },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/expertly-network', external: true },
];

function LinkRow({ label, links, strong = false }: { label: string; links: FooterLink[]; strong?: boolean }) {
  const cls = strong
    ? 'text-base font-medium tracking-[0.01em] text-white/85 transition-colors hover:text-accent-2'
    : 'text-base tracking-[-0.005em] text-white/60 transition-colors hover:text-white';
  return (
    <nav aria-label={label}>
      <ul className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 max-[600px]:gap-x-6">
        {links.map((link) => (
          <li key={link.href}>
            {link.external ? (
              <a
                href={link.href}
                {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={cls}
              >
                {link.label}
              </a>
            ) : (
              <Link href={link.href} className={cls}>
                {link.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

// A compact centred block on the dark band with the brand-green glow: the GrowXQ logo, three rows
// of links (pages, legal, contact), then the copyright line.
export function Footer() {
  return (
    <footer aria-label="Site footer" className="relative overflow-hidden bg-ink text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_90%_at_15%_120%,color-mix(in_oklab,var(--accent)_35%,transparent),transparent_70%),radial-gradient(50%_80%_at_90%_125%,color-mix(in_oklab,var(--accent)_25%,transparent),transparent_70%)]"
      />
      <div className="relative mx-auto flex max-w-[900px] flex-col items-center gap-10 px-6 py-20 text-center max-[600px]:gap-7 max-[600px]:pb-14 max-[600px]:pt-12">
        <Link href="/" aria-label="GrowXQ home" className="select-none">
          <LogoImage surface="dark" height={52} className="max-[600px]:![--logo-h:37px]" />
        </Link>

        <LinkRow label="Footer pages" links={PAGE_LINKS} strong />
        <LinkRow label="Legal" links={LEGAL_LINKS} />
        <LinkRow label="Contact" links={CONTACT_LINKS} />

        <p className="mt-2 font-mono text-xs tracking-[0.06em] text-white/35">
          © {new Date().getFullYear()} GrowXQ · All rights reserved
        </p>
      </div>
    </footer>
  );
}
