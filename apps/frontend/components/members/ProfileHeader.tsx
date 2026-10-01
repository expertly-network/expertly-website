'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { MemberDto } from '@shared/member';

type PdfState = 'idle' | 'generating' | 'error';

// `.mp-action-btn`
const ACTION_BTN =
  'inline-flex w-[120px] items-center justify-center gap-1.5 whitespace-nowrap rounded-input border-[1.5px] border-line-2 bg-bg-card px-3.5 py-2 font-mono text-caption font-semibold text-ink transition-colors hover:border-ink-3 hover:bg-bg-alt disabled:cursor-wait disabled:opacity-60 max-[639px]:w-auto max-[639px]:flex-1';

// Tier badge reads "Seasoned Professional" for that tier, plainly "Member" otherwise.
export function ProfileHeader({ member }: { member: MemberDto }) {
  const [copied, setCopied] = useState(false);
  const [pdfState, setPdfState] = useState<PdfState>('idle');

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: `${member.name} - Expertly`, url }).catch(() => {});
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

  const actions = (
    <>
      <button
        type="button"
        onClick={share}
        className={`${ACTION_BTN} ${copied ? 'border-accent text-accent' : ''}`}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        )}
        {copied ? 'Link copied!' : 'Share'}
      </button>
      <button
        type="button"
        onClick={downloadPdf}
        disabled={pdfState === 'generating'}
        className={`${ACTION_BTN} ${pdfState === 'error' ? 'border-error text-error' : ''}`}
        title={pdfState === 'error' ? 'Could not generate the PDF — click to try again' : 'Download profile as PDF'}
      >
        {pdfState === 'generating' ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
            <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
        {pdfState === 'generating' ? 'Preparing…' : pdfState === 'error' ? 'Retry PDF' : 'PDF'}
      </button>
    </>
  );

  const location = [member.city, member.country].filter(Boolean).join(', ');
  const designation =
    member.headline && member.firmName && member.firmName !== 'Independent'
      ? `${member.headline} at ${member.firmName}`
      : member.headline || (member.firmName !== 'Independent' ? member.firmName : '');
  const primaryPractice = member.services[0]?.name;
  const isSeasoned = member.memberTier === 'seasoned_professional';

  return (
    <div>
      <Link
        href="/members"
        className="mb-5 inline-flex items-center gap-1.5 text-profile-item text-ink-3 transition-colors hover:text-ink"
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
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:pr-36">
            <span className="text-[clamp(22px,3vw,30px)] font-bold leading-[1.1] tracking-[-0.02em] text-ink">
              {member.name}
            </span>
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

          {designation && <p className="mt-1 text-base font-medium text-ink-3 sm:pr-36">{designation}</p>}

          <div className="mt-4 flex flex-wrap gap-4 text-profile-item text-ink-3 sm:pr-36">
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

          {/* `.mp-profile-actions` — pinned bottom-right of the header card from sm up; a
              full-width row under the stats on phones, where there's no room beside them. */}
          <div className="absolute bottom-6 right-6 hidden flex-col gap-2 sm:flex">{actions}</div>
          <div className="mt-5 flex gap-2 sm:hidden">{actions}</div>
        </div>
      </div>
    </div>
  );
}
