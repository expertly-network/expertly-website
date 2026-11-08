'use client';

import Image from 'next/image';
import { mustHotlink } from '@/lib/images';
import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import { formatRate } from '@/lib/members/format';
import { RequestConsultationModal } from '@/components/consultations/RequestConsultationModal';
import { TierBadge } from '@/components/members/TierBadge';
import type { MemberListItemDto } from '@shared/member';

// One directory entry, as a single link to the member's profile.
// Phones: a compact, scannable row — photo, name, primary service (the deciding fact, in accent),
// firm · location, then rate · experience · tier — so several members fit on a screen. No bio and
// no Request button here: the profile carries both, with a sticky Request Consultation bar.
// Larger screens: the full card, where the consultation button stops propagation so it doesn't
// also trigger navigation.

function VerifiedTick({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className="flex-none rounded-full text-ok shadow-[0_0_0_2px_color-mix(in_oklab,var(--ok)_25%,transparent)]"
      aria-label="Verified"
    >
      <circle cx="12" cy="12" r="10" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function MemberCard({
  member,
  isOwnProfile,
  viewerName,
  viewerEmail,
}: {
  member: MemberListItemDto;
  isOwnProfile?: boolean;
  viewerName?: string;
  viewerEmail?: string;
}) {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const location = [member.city, member.country].filter(Boolean).join(', ');
  const roleText = member.firmName
    ? `${member.headline ?? 'Member'} at ${member.firmName}`
    : `${member.headline ?? 'Member'} as an independent practitioner`;
  const visibleServices = member.services.slice(0, 2);
  const [primaryService, ...otherServices] = member.services;
  const rate = formatRate(member.rateMinCents, member.rateMaxCents, member.rateCurrency);
  // Tighter on phones so the rate never truncates: "$100–$475/hr".
  const compactRate = rate.replace(/ – /g, '–').replace(' / hr', '/hr');
  const years = `${member.yearsOfExperience} yr${member.yearsOfExperience === 1 ? '' : 's'} exp`;
  const practice = [member.firmName ?? 'Independent practitioner', location].filter(Boolean).join(' · ');

  return (
    <>
      <Link
        href={`/members/${member.slug}`}
        className="block rounded-2xl border border-line bg-bg-card transition-colors hover:border-line-2"
      >
        {/* Phones */}
        <div className="flex items-center gap-3.5 p-3.5 sm:hidden">
          {/* The tier rides on the photo's bottom edge (like a marketplace "Superhost" badge), keeping the
              facts line free for rate and experience. */}
          <div className="relative flex-none">
            {member.photoUrl ? (
              <Image
                src={member.photoUrl}
                unoptimized={mustHotlink(member.photoUrl)}
                alt=""
                width={152}
                height={192}
                sizes="76px"
                className="h-24 w-[76px] flex-none rounded-xl border border-line object-cover object-top"
              />
            ) : (
              <div className="flex h-24 w-[76px] flex-none items-center justify-center rounded-xl border border-line bg-bg-alt text-lg font-semibold text-ink-4">
                {member.initials}
              </div>
            )}
            {member.memberTier === 'budding_entrepreneur' && (
              <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-bg-card">
                <TierBadge tier="budding_entrepreneur" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-semibold leading-tight text-ink">{member.name}</span>
              {member.isVerified && <VerifiedTick size={15} />}
            </div>
            {primaryService && (
              <div className="mt-1 truncate text-[13px] font-medium text-accent">
                {primaryService.name}
                {otherServices.length > 0 && <span className="font-normal text-ink-4"> +{otherServices.length}</span>}
              </div>
            )}
            <div className="mt-0.5 truncate text-xs text-ink-3">{practice}</div>
            {/* The rate never truncates; on the narrowest phones experience wraps under it instead. */}
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
              <span className="whitespace-nowrap font-semibold text-ink">{compactRate}</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap text-ink-3">
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                  className="flex-none text-ink-4"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
                {years}
              </span>
            </div>
          </div>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="flex-none text-ink-4"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </div>

        {/* Larger screens */}
        <div className="hidden grid-cols-[156px_1fr] gap-7 p-6 sm:grid">
          {member.photoUrl ? (
            <Image
              src={member.photoUrl}
              unoptimized={mustHotlink(member.photoUrl)}
              alt={member.name}
              width={312}
              height={392}
              sizes="156px"
              className="h-[196px] w-[156px] rounded-xl border border-line object-cover object-top"
            />
          ) : (
            <div className="flex h-[196px] w-[156px] items-center justify-center rounded-xl border border-line bg-bg-alt text-4xl font-semibold text-ink-4">
              {member.initials}
            </div>
          )}

          <div className="flex min-w-0 flex-col">
            <div className="mb-1 flex flex-wrap items-center gap-2.5">
              <span className="text-title text-ink">{member.name}</span>
              {member.isVerified && <VerifiedTick size={18} />}
              {/* Cards badge Budding only — as in the prototype; Seasoned is the unmarked default here. */}
              {member.memberTier === 'budding_entrepreneur' && <TierBadge tier="budding_entrepreneur" />}
            </div>

            <p className="mb-3 truncate text-sm text-ink-3">{roleText}</p>

            <div className="mb-4 flex flex-wrap items-center gap-0 text-[13px] text-ink-2">
              {location && (
                <span className="mr-3.5 flex items-center gap-1.5 border-r border-line-2 pr-3.5">
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="flex-none text-ink-4"
                  >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {location}
                </span>
              )}
              <span className="mr-3.5 flex items-center gap-1.5 border-r border-line-2 pr-3.5">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="flex-none text-ink-4"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" />
                </svg>
                {member.yearsOfExperience}y exp.
              </span>
              <span className="font-semibold text-ink">{rate}</span>
            </div>

            {member.bio && <p className="mb-[18px] line-clamp-2 text-sm leading-relaxed text-ink-3">{member.bio}</p>}

            <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line pt-4">
              {visibleServices.map((service) => (
                <Badge key={service.id} variant="neutral" className="font-bold">
                  {service.name}
                </Badge>
              ))}
              {!isOwnProfile && (
                <Button
                  size="sm"
                  className="ml-auto"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setRequestModalOpen(true);
                  }}
                >
                  Request Consultation
                </Button>
              )}
            </div>
          </div>
        </div>
      </Link>
      <RequestConsultationModal
        memberId={member.id}
        memberName={member.name}
        services={member.services}
        prefillName={viewerName}
        prefillEmail={viewerEmail}
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
      />
    </>
  );
}
