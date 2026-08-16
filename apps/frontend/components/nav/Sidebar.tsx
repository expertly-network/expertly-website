import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session-claims';
import { Button } from '@/components/ui/Button';
import { SidebarSignOut } from '@/components/nav/SidebarSignOut';

// Left sidebar shell — matches design/static_html's .d1-sidebar, confirmed against the real
// rendered design (not just CSS source, which drifted from what actually renders): collapsed
// to a 56px icon-only rail by default on EVERY page (not homepage-specific), expands to
// 248px on hover as an overlay (doesn't push content — sticky positioning, higher z-index,
// box-shadow), 0.32s cubic-bezier width transition. Verified live via
// getComputedStyle(document.querySelector('.d1-sidebar')) against both index.html and
// members.html.
//
// Below md (768px, close enough to the design's own 760px breakpoint), this collapses to a
// horizontal icon-only top bar instead — matching dashboard-shell.css's own mobile override
// (sidebar becomes `position: relative; flex-direction: row`, labels/footer hidden). No
// hover-expand on mobile (nothing to hover) — full nav access there is a `me`nu tap target,
// not built yet; flagged, not silently dropped.
//
// Still not ported: the portal search trigger (⌘K) and notifications bell (no backend for
// either), and per-route active-link highlighting (needs the current pathname — would need
// making this a client component).

const EXPLORE_LINKS = [
  {
    href: '/articles',
    label: 'Articles',
    icon: (
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    ),
  },
  {
    href: '/events',
    label: 'Events',
    icon: <path d="M3 4h18v18H3zM16 2v4M8 2v4M3 10h18" />,
  },
  {
    href: '/members',
    label: 'Members',
    icon: <path d="M11 3a8 8 0 108 8 8 8 0 00-8-8zM21 21l-4.35-4.35" />,
  },
] as const;

const MEMBER_LINKS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  },
  {
    href: '/peer-connect',
    label: 'Peer Connect',
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </>
    ),
  },
  {
    href: '/learnings',
    label: 'Learnings',
    icon: (
      <>
        <path d="M22 10L12 5 2 10l10 5 10-5z" />
        <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
        <path d="M22 10v6" />
      </>
    ),
  },
  {
    href: '/templates',
    label: 'Templates',
    icon: (
      <>
        <rect x="7" y="7" width="13" height="13" rx="2" />
        <path d="M4 16V4a1 1 0 011-1h12" />
      </>
    ),
  },
  {
    href: '/perks',
    label: 'Perks & Products',
    icon: (
      <>
        <path d="M20.59 13.41L13.42 20.6a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
        <circle cx="7" cy="7" r="1.5" />
      </>
    ),
  },
] as const;

function NavIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] flex-none opacity-80"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function NavLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      title={label}
      className="flex items-center gap-3 rounded-[9px] px-3 py-[11px] text-[15px] font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white md:px-[13px]"
    >
      {children}
      <span className="md:hidden md:group-hover:inline">{label}</span>
    </Link>
  );
}

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden px-3 pb-2 pt-[18px] font-mono text-[11px] tracking-[0.12em] text-white/30 md:group-hover:block">
      {children}
    </div>
  );
}

export async function Sidebar() {
  const profile = await getSessionUser();
  const isMember = profile?.role === 'member' || profile?.role === 'admin';

  return (
    <aside
      className="group sticky top-0 z-[70] flex w-full flex-none items-center gap-1 overflow-x-auto border-b border-white/10 bg-ink px-3 py-2
        md:h-screen md:w-14 md:flex-col md:items-stretch md:gap-0 md:overflow-hidden md:overflow-y-auto md:border-b-0 md:px-3.5 md:py-[22px]
        md:transition-[width] md:duration-[320ms] md:ease-[cubic-bezier(0.22,1,0.36,1)] md:hover:w-[248px] md:hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]"
    >
      {/* Logo — hidden on mobile (fits in the icon bar poorly at that size), a small "E."
          crossfades to the full wordmark on hover on desktop. */}
      <div className="relative hidden h-6 w-full flex-none pl-[7px] pt-1.5 md:mb-[22px] md:block">
        <Link
          href="/"
          aria-label="Expertly home"
          className="absolute inset-0 flex items-center whitespace-nowrap text-[20px] font-semibold tracking-[-0.02em] text-white opacity-100 transition-opacity duration-150 md:group-hover:opacity-0"
        >
          E<span className="text-accent-2">.</span>
        </Link>
        <Link
          href="/"
          aria-label="Expertly home"
          className="absolute inset-0 flex items-center whitespace-nowrap text-[20px] font-semibold tracking-[-0.02em] text-white opacity-0 transition-opacity delay-100 duration-150 md:group-hover:opacity-100"
        >
          Expertly<span className="text-accent-2">.</span>
        </Link>
      </div>

      <nav className="flex flex-1 items-center gap-1 md:flex-col md:items-stretch md:gap-3">
        <NavLabel>Explore</NavLabel>
        {EXPLORE_LINKS.map((link) => (
          <NavLink key={link.href} href={link.href} label={link.label}>
            <NavIcon>{link.icon}</NavIcon>
          </NavLink>
        ))}
        {!profile && (
          <NavLink href="/membership" label="Expertly Benefits">
            <NavIcon>
              <path d="M12 8a6 6 0 106 6M15.5 13.5L17 22l-5-3-5 3 1.5-8.5" />
            </NavIcon>
          </NavLink>
        )}
        {profile && (
          <NavLink href="/my-consultations" label="My Consultations">
            <NavIcon>
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </NavIcon>
          </NavLink>
        )}

        {isMember && (
          <>
            <div className="hidden h-px w-full bg-white/[0.08] md:block" />
            <NavLabel>Member Portal</NavLabel>
            {MEMBER_LINKS.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label}>
                <NavIcon>{link.icon}</NavIcon>
              </NavLink>
            ))}
            <span
              title="Discussions — coming soon"
              className="hidden items-center gap-3 rounded-[9px] px-[13px] py-[11px] text-[15px] font-medium text-white/70 opacity-50 md:flex"
            >
              <NavIcon>
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </NavIcon>
              <span className="hidden md:group-hover:inline">Discussions</span>
              <span className="ml-auto hidden rounded-full bg-white/[0.08] px-1.5 py-0.5 font-mono text-[8.5px] font-bold tracking-[0.06em] text-accent-2 md:group-hover:inline">
                Soon
              </span>
            </span>
          </>
        )}
      </nav>

      {/* Footer — collapsed to just an icon on mobile / collapsed desktop rail, full
          buttons/account row only visible on hover (desktop) or always (mobile just shows
          the icon-sized version since there's no hover state to reveal into). */}
      <div className="flex flex-none items-center gap-2.5 md:mt-auto md:w-full md:border-t md:border-white/10 md:pt-3.5">
        {profile ? (
          <>
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-white/10 text-[13px] font-semibold text-white">
              {(profile.first_name || profile.email).charAt(0).toUpperCase()}
            </div>
            <div className="hidden min-w-0 flex-1 md:group-hover:block">
              <b className="block truncate text-[12.5px] font-medium text-white">
                {profile.first_name || 'Account'}
              </b>
              <span className="block truncate text-[11px] text-white/40">{profile.email}</span>
            </div>
            <div className="hidden md:group-hover:block">
              <SidebarSignOut />
            </div>
          </>
        ) : (
          <>
            <Link
              href="/login"
              title="Sign in"
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-lg text-white/70 hover:bg-white/[0.06] hover:text-white md:group-hover:hidden"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </Link>
            <div className="hidden w-full flex-col gap-2 px-1 md:group-hover:flex">
              <Button href="/apply" fullWidth>
                Apply Now
              </Button>
              <Button href="/login" variant="ghost" fullWidth className="text-white/80 hover:bg-white/[0.06] hover:text-white">
                Sign In
              </Button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
