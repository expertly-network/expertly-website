'use client';

import Link from 'next/link';
import { Button } from '@/components/ui';
import type { MemberDto } from '@shared/member';

// Matches design/static_html/member-profile.html's `.mp-header-card` exactly: a dark
// gradient cover band (`.mp-header-band`, 112px, two soft radial glows) with a 144px
// rounded-square avatar pulled up to overlap it (`margin-top:-64px`), a circular verified
// badge at the avatar's bottom-right corner, a star-shaped verified icon next to the name
// (yes, both — the design shows verification twice), and a tier badge that reads
// "Seasoned Professional" (amber) for that tier or plainly "Member" (grey) otherwise — not
// "Budding Entrepreneur", confirmed from the design's own JS.
export function ProfileHeader({ member }: { member: MemberDto }) {
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: member.name, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  const location = [member.city, member.country].filter(Boolean).join(', ');
  const designation =
    member.headline && member.firmName && member.firmName !== 'Independent'
      ? `${member.headline} at ${member.firmName}`
      : member.headline || (member.firmName !== 'Independent' ? member.firmName : '');
  const primaryPractice = member.practiceAreas[0]?.name;
  const isSeasoned = member.memberTier === 'seasoned_professional';

  return (
    <div>
      <Link
        href="/members"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to Members
      </Link>

      <div className="overflow-hidden rounded-card border border-line bg-bg-card shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
        <div className="relative h-[112px] overflow-hidden bg-[#033c2f]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[30px] -left-10 h-[200px] w-[200px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.08) 0%, transparent 70%)' }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-5 right-[10%] h-[180px] w-[180px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(0,165,130,0.07) 0%, transparent 70%)' }}
          />
        </div>

        <div className="relative px-6 pb-6">
          <div className="relative z-[2] -mt-16 flex items-end justify-between">
            <div className="relative flex-none">
              {member.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.photoUrl}
                  alt={member.name}
                  className="h-36 w-36 rounded-2xl border-4 border-bg-card object-cover object-top shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
                />
              ) : (
                <div className="flex h-36 w-36 items-center justify-center rounded-2xl border-4 border-bg-card bg-[#033c2f] text-4xl font-bold text-bg-card shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
                  {member.initials}
                </div>
              )}
              {member.isVerified && (
                <div className="absolute -bottom-1.5 -right-1.5 z-[3] flex h-8 w-8 items-center justify-center rounded-full border-2 border-bg-card bg-accent">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8l4 4 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
            </div>

            <div className="mb-6 hidden flex-col gap-2 sm:flex">
              <Button variant="secondary" size="sm" onClick={share} className="w-[120px]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
              </Button>
              <Button variant="secondary" size="sm" disabled title="Coming soon" className="w-[120px]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                PDF
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <span className="text-[clamp(22px,3vw,30px)] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
              {member.name}
            </span>
            {member.isVerified && (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-none" aria-label="Verified">
                <path d="M12 2L14.5 7H20l-4.5 4 1.5 6L12 14l-5 3 1.5-6L4 7h5.5L12 2z" fill="var(--accent)" />
                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-[3px] font-mono text-[11px] font-semibold tracking-[0.02em] ${
                isSeasoned
                  ? 'border-[#fde68a] bg-[#fef3c7] text-[#d97706]'
                  : 'border-line bg-line text-ink-3'
              }`}
            >
              {isSeasoned ? 'Seasoned Professional' : 'Member'}
            </span>
          </div>

          {designation && <p className="mt-1 text-base font-medium text-ink-3">{designation}</p>}

          <div className="mt-4 flex flex-wrap gap-4 text-[14.5px] text-ink-3">
            {location && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-none text-accent">
                  <path d="M12 2C8.7 2 6 4.7 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6z" stroke="currentColor" strokeWidth="1.6" />
                  <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                {location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-none text-accent">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {member.yearsOfExperience}+ years experience
            </span>
            {primaryPractice && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-none text-accent">
                  <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 4H6a2 2 0 00-2 2v13a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                {primaryPractice}
              </span>
            )}
          </div>

          <div className="mt-4 flex gap-2 sm:hidden">
            <Button variant="secondary" size="sm" onClick={share} fullWidth>
              Share
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
