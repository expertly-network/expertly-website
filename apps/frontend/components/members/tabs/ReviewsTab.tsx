'use client';

import { HighlightedEntry, TROPHY_ICON } from '@/components/members/HighlightedEntry';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, SwipeRow } from '@/components/ui';
import { ProfileSectionEmpty, ProfileSectionHeader, SECTION_ICONS } from '@/components/members/ProfileSection';
import { VerificationBadge } from '@/components/members/VerificationBadge';
import { AddProofPrompt } from '@/components/members/AddProofPrompt';
import type { EditTarget } from '@/components/members/edit/SectionEditModal';
import { MemberRecommendations } from '@/components/members/tabs/MemberRecommendations';
import { initialsOf } from '@/lib/members/format';
import type { MemberDto, MemberTestimonial } from '@shared/member';

// `.mp-testi-footer` — shared by the grid card and the full-quote modal.
function TestimonialAuthor({ t, compact }: { t: MemberTestimonial; compact: boolean }) {
  const meta = [t.clientTitle, t.clientCompany].filter(Boolean).join(', ');
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
        </strong>
        {meta && (
          <span className={`mt-px block truncate text-ink-3 ${compact ? 'text-[10.5px]' : 'text-[11.5px]'}`}>
            {meta}
          </span>
        )}
      </div>
    </div>
  );
}

export function ReviewsTab({
  member,
  isOwnProfile,
  onEdit,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
  onEdit: (target: EditTarget) => void;
}) {
  const [openTestimonial, setOpenTestimonial] = useState<MemberTestimonial | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const closeModal = useCallback(() => setOpenTestimonial(null), []);

  // The testimonials are one horizontal row on every width. Phones swipe; from `sm` up a pair of
  // arrow buttons pages the row for mouse users, each enabled only while there is more that way.
  const measure = useCallback(() => {
    const el = rowRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [measure, member.testimonials.length]);

  function scrollRow(direction: -1 | 1) {
    const el = rowRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  }

  const editTestimonials = isOwnProfile ? () => onEdit({ section: 'testimonials' }) : undefined;
  const editAwards = isOwnProfile ? () => onEdit({ section: 'awards' }) : undefined;
  const hasTestimonials = member.testimonials.length > 0;
  const hasAwards = member.awards.length > 0;

  return (
    <div className="flex flex-col gap-7">
      {(hasTestimonials || isOwnProfile) && (
        <section>
          <ProfileSectionHeader
            label="Client Testimonials"
            icon={SECTION_ICONS.testimonials}
            onEdit={editTestimonials}
          />
          {!hasTestimonials ? (
            <ProfileSectionEmpty
              title="No testimonials yet."
              hint="Showcase client feedback"
              onEdit={editTestimonials}
            />
          ) : (
            <>
              {/* `.mp-testi-outer` — a horizontal snap row (not a scrolling grid), next card peeking in. */}
              <SwipeRow
                label="Client testimonials"
                scroll="always"
                itemWidth="card"
                scrollRef={rowRef}
                onScroll={measure}
              >
                {member.testimonials.map((t) => (
                  <div
                    key={t.id}
                    className="relative flex h-full min-w-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-bg-card text-left transition-[background,border-color,box-shadow] odd:bg-bg-alt hover:border-[color-mix(in_oklab,var(--accent)_28%,var(--line))] hover:shadow-[0_4px_16px_rgba(0,0,0,0.05)]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenTestimonial(t)}
                      className="relative flex min-w-0 flex-1 flex-col gap-2 px-[15px] pb-2 pt-4 text-left"
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
                    <div className="flex flex-wrap items-center justify-between gap-2 px-[15px] pb-3">
                      <VerificationBadge verified={t.isVerified} className="ml-auto" />
                    </div>
                    {isOwnProfile && !t.isVerified && (
                      <div className="px-[15px] pb-3 empty:hidden">
                        <AddProofPrompt
                          isOwnProfile={isOwnProfile}
                          verified={t.isVerified}
                          hasProof={(t.proofAttachments?.length ?? 0) > 0}
                          onAddProof={() => onEdit({ section: 'testimonials', itemId: t.id })}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </SwipeRow>
              {(canPrev || canNext) && (
                <div className="mt-3.5 hidden justify-end gap-2 sm:flex">
                  {([-1, 1] as const).map((direction) => (
                    <button
                      key={direction}
                      type="button"
                      onClick={() => scrollRow(direction)}
                      disabled={direction === -1 ? !canPrev : !canNext}
                      aria-label={direction === -1 ? 'Previous testimonials' : 'More testimonials'}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-line bg-bg-card text-accent transition-colors hover:border-[color-mix(in_oklab,var(--accent)_28%,var(--line))] hover:bg-[color-mix(in_oklab,var(--accent)_8%,var(--bg-card))] disabled:cursor-default disabled:text-ink-4 disabled:hover:border-line disabled:hover:bg-bg-card"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        aria-hidden="true"
                        className={direction === -1 ? 'rotate-90' : '-rotate-90'}
                      >
                        <path
                          d="M6 9l6 6 6-6"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {(hasAwards || isOwnProfile) && (
        <section>
          <ProfileSectionHeader label="Awards & Recognition" icon={SECTION_ICONS.awards} onEdit={editAwards} />
          {!hasAwards ? (
            <ProfileSectionEmpty title="No awards yet." hint="Showcase your recognition" onEdit={editAwards} />
          ) : (
            // Boxless and highlighted — same entry layout as Education (HighlightedEntry).
            <ul className="flex flex-col gap-5">
              {member.awards.map((award) => (
                <HighlightedEntry
                  key={award.id}
                  year={award.year}
                  icon={TROPHY_ICON}
                  title={award.title}
                  subtitle={award.issuingBody}
                  description={award.description}
                  actions={<VerificationBadge verified={award.isVerified} />}
                  footer={
                    <AddProofPrompt
                      isOwnProfile={isOwnProfile}
                      verified={award.isVerified}
                      hasProof={(award.proofAttachments?.length ?? 0) > 0}
                      onAddProof={() => onEdit({ section: 'awards', itemId: award.id })}
                    />
                  }
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <MemberRecommendations memberId={member.id} memberName={member.name} isOwnProfile={isOwnProfile} />

      <Modal open={openTestimonial !== null} onClose={closeModal} title="Client testimonial">
        {openTestimonial && (
          <>
            <p className="mb-[18px] whitespace-pre-line text-[15px] italic leading-[1.75] text-ink-2">
              &ldquo;{openTestimonial.quote}&rdquo;
            </p>
            <TestimonialAuthor t={openTestimonial} compact={false} />
          </>
        )}
      </Modal>
    </div>
  );
}
