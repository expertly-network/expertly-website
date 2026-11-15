'use client';

import { isFullyVerified } from '@/lib/members/fully-verified';
import Image from 'next/image';
import { mustHotlink } from '@/lib/images';
import { useState } from 'react';
import type { MemberDto } from '@shared/member';
import { SHARE_ICON_CLASS } from '@/components/articles/ArticleShareBar';
import { ChangePhotoButton } from '@/components/members/ChangePhotoButton';
import { MEMBER_TIER_LABEL } from '@/lib/members/format';

type PdfState = 'idle' | 'generating' | 'error';

// Tier badge: "Seasoned Professional" (amber) or "Budding Professional" (neutral) — MEMBER_TIER_LABEL.
// `canDownloadPdf` is false for signed-out visitors: they only have the public preview, so the PDF
// would come out nearly empty.
export function ProfileHeader({
  member,
  isOwnProfile = false,
  canDownloadPdf = true,
}: {
  member: MemberDto;
  isOwnProfile?: boolean;
  canDownloadPdf?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [pdfState, setPdfState] = useState<PdfState>('idle');

  // The native share sheet where there is one (phones), otherwise the link is copied.
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${member.name} - GrowXQ`, url }).catch(() => {});
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard permission denied — nothing useful to fall back to.
    }
  }

  async function downloadPdf() {
    setPdfState('generating');
    try {
      // Loaded on demand so @react-pdf/renderer (~500 KB) never ships with the page itself.
      const { downloadMemberProfilePdf } = await import('@/components/members/pdf/downloadMemberProfilePdf');
      await downloadMemberProfilePdf(member);
      setPdfState('idle');
    } catch {
      setPdfState('error');
    }
  }

  // Two quiet tools in the article page's bare style (no frame): an icon and the word.
  const TOOL = `${SHARE_ICON_CLASS} !w-auto gap-1.5 px-3 text-profile-item font-medium`;
  const actions = (
    <div className="flex items-center">
      <button type="button" onClick={share} className={`${TOOL} ${copied ? 'text-accent' : ''}`}>
        {copied ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        )}
        {copied ? 'Link copied!' : 'Share'}
      </button>
      {canDownloadPdf && (
        <button
          type="button"
          onClick={downloadPdf}
          disabled={pdfState === 'generating'}
          title={pdfState === 'error' ? 'Could not generate the PDF — click to try again' : 'Download profile as PDF'}
          className={`${TOOL} ${pdfState === 'error' ? 'text-error' : ''}`}
        >
          {pdfState === 'generating' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          {pdfState === 'generating' ? 'Preparing…' : pdfState === 'error' ? 'Retry PDF' : 'PDF'}
        </button>
      )}
    </div>
  );

  const location = [member.city, member.country].filter(Boolean).join(', ');
  // The headline is the member's own words (edited in About) and is shown exactly as written; the
  // firm is a separate fact, so it is never glued on ("Partner at X at Y"). It shows beside the
  // location and experience below, and stands in for the headline only when there is none.
  const firm = member.firmName && member.firmName !== 'Independent' ? member.firmName : null;
  const designation = member.headline || firm || '';
  const primaryPractice = member.services[0]?.name;
  const isSeasoned = member.memberTier === 'seasoned_professional';

  return (
    <div>
      <div className="overflow-hidden rounded-card border border-line bg-bg-card shadow-panel max-[720px]:rounded-none max-[720px]:border-x-0 max-[720px]:shadow-none">
        <div className="relative h-20 overflow-hidden bg-ink sm:h-[112px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[30px] -left-10 h-[200px] w-[200px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(217,119,6,0.08) 0%, transparent 70%)' }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-5 right-[10%] h-[180px] w-[180px] rounded-full"
            style={{
              background:
                'radial-gradient(circle, color-mix(in oklab, var(--accent) 7%, transparent) 0%, transparent 70%)',
            }}
          />
        </div>

        <div className="relative px-5 pb-3 sm:px-6 sm:pb-6">
          <div className="relative z-[2] -mt-12 flex items-end justify-between sm:-mt-16">
            <div className="relative flex-none">
              {member.photoUrl ? (
                <Image
                  src={member.photoUrl}
                  unoptimized={mustHotlink(member.photoUrl)}
                  alt={member.name}
                  width={144}
                  height={144}
                  priority
                  className="h-24 w-24 rounded-2xl border-4 border-bg-card object-cover object-top shadow-[0_8px_32px_rgba(0,0,0,0.18)] sm:h-36 sm:w-36"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-bg-card bg-ink text-3xl font-bold text-bg-card shadow-[0_8px_32px_rgba(0,0,0,0.18)] sm:h-36 sm:w-36 sm:text-4xl">
                  {member.initials}
                </div>
              )}
              {isOwnProfile && <ChangePhotoButton memberId={member.id} />}
              {isFullyVerified(member) && (
                <div className="absolute -bottom-1.5 -right-1.5 z-[3] flex h-8 w-8 items-center justify-center rounded-full border-2 border-bg-card bg-accent">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8l4 4 6-7"
                      className="stroke-white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2.5 sm:mt-4 sm:pr-44">
            <span className="text-[clamp(22px,3vw,30px)] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
              {member.name}
            </span>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-[3px] font-mono text-[11px] font-semibold ${
                isSeasoned ? 'border-amber-200 bg-amber-100 text-amber-600' : 'border-line bg-line text-ink-3'
              }`}
            >
              {MEMBER_TIER_LABEL[member.memberTier] ?? 'Member'}
            </span>
          </div>

          {designation && <p className="mt-1 text-base font-medium text-ink-3 sm:pr-44">{designation}</p>}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-profile-item text-ink-3 sm:mt-4 sm:gap-4 sm:pr-44">
            {location && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-none text-accent">
                  <path
                    d="M12 2C8.7 2 6 4.7 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.3-2.7-6-6-6z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                  />
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
            {firm && member.headline && (
              <span className="inline-flex items-center gap-1.5">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="flex-none text-accent"
                  aria-hidden="true"
                >
                  <path
                    d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4M9 10h.01M15 10h.01M9 14h.01M15 14h.01"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {firm}
              </span>
            )}
            {primaryPractice && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-none text-accent">
                  <rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M8 4H6a2 2 0 00-2 2v13a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                {primaryPractice}
              </span>
            )}
          </div>

          {/* Below 1024px the sidebar's fee card is hidden for visitors, so its availability note
              (e.g. "Away 13–20 Nov") moves up here. */}
          {!isOwnProfile && member.availabilityNotes && (
            <p className="mt-3 flex items-start gap-1.5 text-caption leading-relaxed text-ink-3 sm:pr-44 min-[1024px]:hidden">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
                className="mt-0.5 flex-none text-accent"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {member.availabilityNotes}
            </p>
          )}

          {/* `.mp-profile-actions` — pinned bottom-right of the header card from sm up; a
              full-width row under the stats on phones, where there's no room beside them. */}
          <div className="absolute bottom-4 right-3 hidden sm:flex">{actions}</div>
          <div className="-ml-3 mt-3 flex sm:hidden">{actions}</div>
        </div>
      </div>
    </div>
  );
}
