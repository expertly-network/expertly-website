import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import type { Profile } from '@/lib/auth/types';
import { SignOutButton } from '@/components/layout/SignOutButton';

// 'rail' = the desktop collapsed-by-default, hover-to-expand icon rail (Sidebar below —
// matches design/static_html's .d1-sidebar, 56px collapsed / 248px on hover, an Instagram-
// style floating overlay per its own inline comment). 'full' = always fully expanded, no
// hover behavior (MobileDrawer, which is already a full-width slide-out with nothing to
// collapse into).
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
const BENEFITS_ICON = <path d="M12 2a6 6 0 100 12 6 6 0 000-12zM15.5 13.5L17 22l-5-3-5 3 1.5-8.5" />;

// Matches design/static_html's guest sidebar nav: Articles, Events, Members, Membership
// Benefits, in that order. Articles/Events/Members are real destinations; "Expertly Benefits"
// doesn't exist yet in this app, so it still renders inert (dimmed, non-navigating) with the
// same "Soon" pill treatment the source design itself uses for its own not-yet-live nav
// items (`.nav-soon`/`.soon`), rather than linking to a 404. Reused (in its always-expanded
// 'full' form) inside MobileDrawer too — see that file.
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
      <span className={`${navLinkClasses(variant)} cursor-default opacity-50`} aria-disabled="true">
        <svg {...iconProps}>{BENEFITS_ICON}</svg>
        <span className={navLabelClasses(variant)}>Expertly Benefits</span>
        <span className={soonBadgeClasses(variant)}>SOON</span>
      </span>
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
  // A signed-in `client` hasn't applied for membership yet — the CTA stays relevant and
  // shouldn't disappear just because they've created an account. `member`/`admin` already
  // have membership (or more), so it's dropped for them rather than showing a CTA that
  // doesn't apply to their account anymore.
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

// Collapsed-by-default (56px) icon rail that expands to 248px as a floating overlay on
// hover — matches design/static_html's .d1-sidebar/.d1-shell.revealed behavior exactly
// (including its own "Instagram-style" framing), reimplemented as pure CSS (`group`/
// `group-hover:`) instead of the source's JS mouseenter/mouseleave listener toggling a
// class — same effect, no JS needed. Background is `bg-ink` (`var(--ink)` in the source),
// not `nav-green` — that token belongs to an older, unrelated top-nav variant.
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
