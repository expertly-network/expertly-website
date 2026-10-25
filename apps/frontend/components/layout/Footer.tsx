import Link from 'next/link';
import { MEMBERSHIP_POLICY_URL, PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/lib/legal';

const PRIMARY_LINKS = [
  { label: 'Expertly', href: '/' },
  { label: 'Articles', href: '/articles' },
  { label: 'Events', href: '/events' },
  { label: 'Benefits', href: '/membership' },
  { label: 'Members', href: '/members' },
];

const LEGAL_LINKS = [
  { label: 'Terms & Conditions', href: TERMS_OF_SERVICE_URL },
  { label: 'Membership Policy', href: MEMBERSHIP_POLICY_URL },
  { label: 'Privacy Policy', href: PRIVACY_POLICY_URL },
];

export function Footer() {
  return (
    <footer className="bg-ink px-6 py-16 max-[600px]:pb-14 max-[600px]:pt-10" aria-label="Site footer">
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
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-[15px] tracking-[-0.005em] text-white/[0.58] transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
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
