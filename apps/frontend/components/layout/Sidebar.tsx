import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import type { Profile } from '@/lib/auth/types';
import { SignOutButton } from '@/components/layout/SignOutButton';

// 'rail' = collapsed icon rail that expands on hover. 'full' = always expanded.
type SidebarVariant = 'rail' | 'full';

function navLinkClasses(variant: SidebarVariant) {
  const base =
    'flex items-center rounded-lg text-[15px] font-medium text-white/[0.68] transition-colors hover:bg-white/[0.06] hover:text-white';
  if (variant === 'full') return `${base} justify-start gap-3 px-3 py-2.5`;
  return `${base} justify-center gap-0 px-2.5 py-2.5 group-hover:justify-start group-hover:gap-3 group-hover:px-3`;
}

function navLabelClasses(variant: SidebarVariant) {
  if (variant === 'full') return '';
  return 'max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[opacity,max-width] duration-200 group-hover:max-w-[160px] group-hover:opacity-100 group-hover:delay-150';
}

function soonBadgeClasses(variant: SidebarVariant) {
  const base =
    'ml-auto flex-none rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[8.5px] font-bold tracking-[0.06em] text-accent-2';
  if (variant === 'full') return base;
  return `${base} hidden group-hover:inline-block`;
}

// Section header ("Explore" / "Member Benefits") — collapses away in the rail variant until
// hover-expanded, matching how nav-link labels behave.
function navSectionLabelClasses(variant: SidebarVariant) {
  const base = 'pb-2 pt-4 font-mono text-eyebrow text-white/30';
  if (variant === 'full') return `${base} px-3`;
  return `${base} px-2.5 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[opacity,max-width,padding] duration-200 group-hover:max-w-[160px] group-hover:px-3 group-hover:opacity-100 group-hover:delay-150`;
}

const ARTICLES_ICON = (
  <path d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
);
const EVENTS_ICON = <path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4zM16 2v4M8 2v4M3 10h18" />;
const MEMBERS_ICON = (
  <>
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.35-4.35" />
  </>
);
const ADMIN_ICON = (
  <path d="M12 2L3 6v6c0 5 3.8 8.5 9 10 5.2-1.5 9-5 9-10V6l-9-4zM9 12l2 2 4-4" />
);
const CONSULTATIONS_ICON = (
  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
);
const DASHBOARD_ICON = (
  <>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
  </>
);
const LEARNINGS_ICON = (
  <>
    <path d="M22 10L12 5 2 10l10 5 10-5z" />
    <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
    <path d="M22 10v6" />
  </>
);
const TEMPLATES_ICON = (
  <>
    <rect x="7" y="7" width="13" height="13" rx="2" />
    <path d="M4 16V4a1 1 0 011-1h12" />
  </>
);
const PERKS_ICON = (
  <>
    <path d="M20.59 13.41L13.42 20.6a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
    <circle cx="7" cy="7" r="1.5" />
  </>
);
const DISCOUNTS_ICON = (
  <>
    <path d="M19 5L5 19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </>
);

// Articles, Events, Members, and (for a client/admin) Consultations are real destinations under
// "Explore". "Member Benefits" is a member-only section — Consultations is real there too
// (a member both sends and receives requests); Dashboard/Learnings/Templates/Perks/Discounts
// don't exist yet, so they render inert with a "Soon" pill instead of linking to a 404.
export function SidebarNav({
  user,
  variant = 'full',
}: {
  user: Profile | null;
  variant?: SidebarVariant;
}) {
  const iconProps = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'shrink-0 opacity-80',
  };

  return (
    <nav className="flex flex-1 flex-col gap-1 px-2">
      <div className={navSectionLabelClasses(variant)}>Explore</div>
      <Link href="/articles" className={navLinkClasses(variant)}>
        <svg {...iconProps}>{ARTICLES_ICON}</svg>
        <span className={navLabelClasses(variant)}>Articles</span>
      </Link>
      <Link href="/events" className={navLinkClasses(variant)}>
        <svg {...iconProps}>{EVENTS_ICON}</svg>
        <span className={navLabelClasses(variant)}>Events</span>
      </Link>
      <Link href="/members" className={navLinkClasses(variant)}>
        <svg {...iconProps}>{MEMBERS_ICON}</svg>
        <span className={navLabelClasses(variant)}>Members</span>
      </Link>
      {user && user.role !== 'member' && (
        <Link href="/consultations" className={navLinkClasses(variant)}>
          <svg {...iconProps}>{CONSULTATIONS_ICON}</svg>
          <span className={navLabelClasses(variant)}>Consultations</span>
        </Link>
      )}

      {user?.role === 'member' && (
        <>
          <div className="my-1 h-px bg-white/10" />
          <div className={navSectionLabelClasses(variant)}>Member Benefits</div>
          <span className={`${navLinkClasses(variant)} cursor-default opacity-50`} aria-disabled="true">
            <svg {...iconProps}>{DASHBOARD_ICON}</svg>
            <span className={navLabelClasses(variant)}>Dashboard</span>
            <span className={soonBadgeClasses(variant)}>SOON</span>
          </span>
          <Link href="/consultations" className={navLinkClasses(variant)}>
            <svg {...iconProps}>{CONSULTATIONS_ICON}</svg>
            <span className={navLabelClasses(variant)}>Consultations</span>
          </Link>
          <span className={`${navLinkClasses(variant)} cursor-default opacity-50`} aria-disabled="true">
            <svg {...iconProps}>{LEARNINGS_ICON}</svg>
            <span className={navLabelClasses(variant)}>Learnings</span>
            <span className={soonBadgeClasses(variant)}>SOON</span>
          </span>
          <span className={`${navLinkClasses(variant)} cursor-default opacity-50`} aria-disabled="true">
            <svg {...iconProps}>{TEMPLATES_ICON}</svg>
            <span className={navLabelClasses(variant)}>Templates</span>
            <span className={soonBadgeClasses(variant)}>SOON</span>
          </span>
          <span className={`${navLinkClasses(variant)} cursor-default opacity-50`} aria-disabled="true">
            <svg {...iconProps}>{PERKS_ICON}</svg>
            <span className={navLabelClasses(variant)}>Perks</span>
            <span className={soonBadgeClasses(variant)}>SOON</span>
          </span>
          <span className={`${navLinkClasses(variant)} cursor-default opacity-50`} aria-disabled="true">
            <svg {...iconProps}>{DISCOUNTS_ICON}</svg>
            <span className={navLabelClasses(variant)}>Discounts</span>
            <span className={soonBadgeClasses(variant)}>SOON</span>
          </span>
        </>
      )}

      {user?.role === 'admin' && (
        <>
          <div className="my-1 h-px bg-white/10" />
          <Link href="/admin" className={navLinkClasses(variant)}>
            <svg {...iconProps}>{ADMIN_ICON}</svg>
            <span className={navLabelClasses(variant)}>Admin</span>
          </Link>
        </>
      )}
    </nav>
  );
}

const SIGN_IN_SVG = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
    <polyline points="10 17 15 12 10 7" />
    <line x1="15" y1="12" x2="3" y2="12" />
  </svg>
);

export function SidebarFooter({
  user,
  variant = 'full',
}: {
  user: Profile | null;
  variant?: SidebarVariant;
}) {
  if (!user) {
    const buttons = (
      <div className="flex flex-col gap-2">
        <Button href="/apply" size="sm" fullWidth>
          Apply Now
        </Button>
        <Button
          href="/login"
          variant="ghost"
          size="sm"
          fullWidth
          className="text-white/80 hover:bg-white/10 hover:text-white"
        >
          Sign In
        </Button>
      </div>
    );

    if (variant === 'full') {
      return <div className="border-t border-white/10 px-3 pb-4 pt-4">{buttons}</div>;
    }

    return (
      <div className="border-t border-white/10 px-2 pb-4 pt-4">
        <div className="flex justify-center group-hover:hidden">
          <Link
            href="/login"
            aria-label="Sign in"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {SIGN_IN_SVG}
          </Link>
        </div>
        <div className="hidden group-hover:block">{buttons}</div>
      </div>
    );
  }

  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`;
  // Only shown for a client who hasn't applied for membership yet.
  const showApplyNow = user.role === 'client';
  const fullInfo = (
    <div className="flex flex-col gap-3">
      {showApplyNow && (
        <Button href="/apply" size="sm" fullWidth>
          Apply Now
        </Button>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm text-white/80">
          {user.first_name} {user.last_name}
        </span>
        <SignOutButton />
      </div>
    </div>
  );

  if (variant === 'full') {
    return <div className="border-t border-white/10 px-4 py-4">{fullInfo}</div>;
  }

  return (
    <div className="border-t border-white/10 px-2 py-4">
      <div className="flex justify-center group-hover:hidden">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
          {initials || '?'}
        </div>
      </div>
      <div className="hidden group-hover:block">{fullInfo}</div>
    </div>
  );
}

// Collapsed icon rail that expands to a floating overlay on hover.
export function Sidebar({ user }: { user: Profile | null }) {
  return (
    <aside
      className="group fixed inset-y-0 left-0 z-30 flex w-14 flex-col overflow-x-hidden overflow-y-auto bg-ink transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:w-64 hover:shadow-[6px_0_32px_rgba(0,0,0,0.28)] max-[1023px]:hidden"
    >
      <div className="flex items-center justify-center px-2 py-5 group-hover:justify-start group-hover:px-4">
        <Logo variant="sidebar" collapsible />
      </div>
      <SidebarNav user={user} variant="rail" />
      <SidebarFooter user={user} variant="rail" />
    </aside>
  );
}
