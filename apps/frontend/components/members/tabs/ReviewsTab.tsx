'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui';
import { ProfileSectionEmpty, ProfileSectionHeader, SECTION_ICONS } from '@/components/members/ProfileSection';
import { getSectionEditBadge, getSectionRejectionNote } from '@/lib/members/edit-badge';
import { formatMonthYear, initialsOf } from '@/lib/members/format';
import type { MemberDto, MemberProfileEditDto, MemberTestimonial } from '@shared/member';

function VerifiedTick() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-label="Verified" className="ml-1 inline flex-none align-[-1px]">
      <path d="M3 8l4 4 6-7" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// `.mp-testi-footer` — shared by the grid card and the full-quote modal.
function TestimonialAuthor({ t, compact }: { t: MemberTestimonial; compact: boolean }) {
  const meta = [t.clientTitle, t.clientCompany].filter(Boolean).join(', ');
  const date = formatMonthYear(t.occurredOn);
  return (
    <div className={`mt-auto flex items-center gap-2 border-t border-line ${compact ? 'pt-2' : 'pt-4'}`}>
      <span
        className={`flex flex-none items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--accent)_15%,transparent)] font-mono font-bold text-accent ${
          compact ? 'h-[30px] w-[30px] text-[11px]' : 'h-9 w-9 text-xs'
        }`}
      >
        {initialsOf(t.clientName)}
      </span>
      <div className="min-w-0 flex-1">
        <strong className={`block font-semibold text-ink ${compact ? 'text-xs' : 'text-[13.5px]'}`}>
          {t.clientName}
          {t.isVerified && <VerifiedTick />}
        </strong>
        {meta && (
          <span className={`mt-px block truncate text-ink-3 ${compact ? 'text-[10.5px]' : 'text-[11.5px]'}`}>{meta}</span>
        )}
      </div>
      {date && (
        <span className={`flex-none font-mono tracking-[0.02em] text-ink-4 ${compact ? 'text-[9.5px]' : 'text-[10.5px]'}`}>
          {date}
        </span>
      )}
    </div>
  );
}

export function ReviewsTab({
  member,
  edits,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  onEdit: (section: 'testimonials' | 'awards') => void;
}) {
  const [openTestimonial, setOpenTestimonial] = useState<MemberTestimonial | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const closeModal = useCallback(() => setOpenTestimonial(null), []);

  // `.mp-testi-scroll-btn` — the grid has a max height; show a chevron only when it overflows.
  const measure = useCallback(() => {
    const el = gridRef.current;
    if (!el) return;
    setCanScroll(el.scrollHeight > el.clientHeight + 1);
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 4);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, member.testimonials.length]);

  function scrollGrid() {
    const el = gridRef.current;
    if (!el) return;
    el.scrollTo({ top: atBottom ? 0 : el.scrollTop + el.clientHeight, behavior: 'smooth' });
  }

  const edit = (section: 'testimonials' | 'awards') => (isOwnProfile ? () => onEdit(section) : undefined);
  const hasTestimonials = member.testimonials.length > 0;
  const hasAwards = member.awards.length > 0;

  if (!hasTestimonials && !hasAwards && !isOwnProfile) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-line">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="var(--ink-4)" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="mb-1 text-profile-item font-semibold text-ink">No reviews yet</div>
        <div className="text-caption text-ink-3">Client testimonials and recognition will appear here.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      {(hasTestimonials || isOwnProfile) && (
        <section>
          <ProfileSectionHeader
            label="Client Testimonials"
            icon={SECTION_ICONS.testimonials}
            badge={getSectionEditBadge('testimonials', edits, member.isVerified)}
            onEdit={edit('testimonials')}
            rejectionNote={getSectionRejectionNote('testimonials', edits)}
          />
          {!hasTestimonials ? (
            <ProfileSectionEmpty
              title="No testimonials yet."
              hint="Showcase client feedback"
              onEdit={edit('testimonials')}
            />
          ) : (
            <>
              {/* `.mp-testi-outer` — 4 / 2 / 1 columns, one row visible (two / four on narrower
                  screens), anything beyond scrolls inside the box. */}
              <div
                ref={gridRef}
                onScroll={measure}
                className="grid max-h-[360px] grid-cols-4 gap-4 overflow-y-auto scroll-smooth [scrollbar-width:none] max-[1100px]:max-h-[736px] max-[1100px]:grid-cols-2 max-[560px]:max-h-[1488px] max-[560px]:grid-cols-1 [&::-webkit-scrollbar]:hidden"
              >
                {member.testimonials.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setOpenTestimonial(t)}
                    className="relative flex h-full flex-col gap-2 overflow-hidden rounded-2xl border border-line bg-bg-card px-[15px] pb-[13px] pt-4 text-left transition-[background,border-color,box-shadow] odd:bg-bg-alt hover:border-[color-mix(in_oklab,var(--accent)_28%,var(--line))] hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)]"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -top-2 right-3.5 select-none font-serif text-[56px] leading-none text-[color-mix(in_oklab,var(--accent)_16%,transparent)]"
                    >
                      &ldquo;
                    </span>
                    <p className="relative line-clamp-[8] text-sm leading-normal text-ink-2">{t.quote}</p>
                    <TestimonialAuthor t={t} compact />
                  </button>
                ))}
              </div>
              {canScroll && (
                <button
                  type="button"
                  onClick={scrollGrid}
                  aria-label={atBottom ? 'Scroll testimonials to top' : 'Show more testimonials'}
                  className="mx-auto mt-3.5 flex h-[34px] w-[34px] items-center justify-center rounded-full border border-line bg-bg-card text-accent transition-colors hover:border-[color-mix(in_oklab,var(--accent)_28%,var(--line))] hover:bg-[color-mix(in_oklab,var(--accent)_8%,var(--bg-card))]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`transition-transform ${atBottom ? 'rotate-180' : ''}`}>
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </>
          )}
        </section>
      )}

      {(hasAwards || isOwnProfile) && (
        <section>
          <ProfileSectionHeader
            label="Awards & Recognition"
            icon={SECTION_ICONS.awards}
            badge={getSectionEditBadge('awards', edits, member.isVerified)}
            onEdit={edit('awards')}
            rejectionNote={getSectionRejectionNote('awards', edits)}
          />
          {!hasAwards ? (
            <ProfileSectionEmpty title="No awards yet." hint="Showcase your recognition" onEdit={edit('awards')} />
          ) : (
            // `.mp-awards-grid` / `.mp-award-card`
            <div className="grid grid-cols-2 gap-3.5 max-[639px]:grid-cols-1">
              {member.awards.map((award) => (
                <div
                  key={award.id}
                  className="flex items-center gap-3.5 rounded-2xl border border-line bg-bg-card px-5 py-[18px] transition-[background,border-color,box-shadow,transform] hover:-translate-y-px hover:border-[color-mix(in_oklab,var(--accent)_28%,var(--line))] hover:bg-[color-mix(in_oklab,var(--accent)_4%,var(--bg-card))] hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)]"
                >
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[13px] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_22%,transparent),color-mix(in_oklab,var(--accent)_7%,transparent))]">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4z" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M7 6H4a1 1 0 00-1 1v1a3 3 0 003 3M17 6h3a1 1 0 011 1v1a3 3 0 01-3 3" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <div className="text-profile-item font-semibold text-ink">{award.title}</div>
                    {(award.issuingBody || award.year) && (
                      <div className="mt-[5px] font-mono text-profile-meta tracking-[0.01em] text-ink-3">
                        {[award.issuingBody, award.year].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {award.description && (
                      <div className="mt-1.5 text-[11.5px] leading-[1.55] text-ink-3">{award.description}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <Modal open={openTestimonial !== null} onClose={closeModal} title="Client testimonial">
        {openTestimonial && (
          <>
            <p className="mb-[18px] whitespace-pre-line text-[15px] italic leading-[1.75] text-ink-2">
              &ldquo;{openTestimonial.quote}&rdquo;
            </p>
            {openTestimonial.serviceName && (
              <p className="mb-3 font-mono text-profile-meta text-ink-3">Service: {openTestimonial.serviceName}</p>
            )}
            <TestimonialAuthor t={openTestimonial} compact={false} />
          </>
        )}
      </Modal>
    </div>
  );
}
