import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import { formatRate } from '@/lib/members/format';
import type { MemberListItemDto } from '@shared/member';

const TIER_BADGE_LABEL: Record<MemberListItemDto['memberTier'], string | null> = {
  budding_entrepreneur: 'Budding',
  seasoned_professional: null,
};

// Matches design/static_html/members.html's `.mv4-card` exactly, including its structure:
// the whole card (photo + content, including the "Request Consultation" button) is one link
// (`<a class="mv4-card">` in the source) — a CSS grid with the photo and content as the two
// row items, so they stretch to equal height and the content column's chip/button row can
// pin itself to the bottom via `margin-top: auto`, aligning with the photo's bottom edge
// naturally. The design nests `<button class="mv4-request-btn">` inside that same `<a>` and
// stops the click from also triggering navigation via `event.stopPropagation()` — replicated
// here the same way, not split into a separate sibling block (which is what this component
// used to do, and why the divider/chips row visually detached from the photo instead of
// tracking its bottom edge).
export function MemberCard({ member }: { member: MemberListItemDto }) {
  const location = [member.city, member.country].filter(Boolean).join(', ');
  const roleText = member.firmName
    ? `${member.headline ?? 'Member'} at ${member.firmName}`
    : `${member.headline ?? 'Member'} as an independent practitioner`;
  const tierBadge = TIER_BADGE_LABEL[member.memberTier];
  const visiblePracticeAreas = member.practiceAreas.slice(0, 2);

  return (
    <Link
      href={`/members/${member.id}`}
      className="grid grid-cols-[156px_1fr] gap-7 rounded-2xl border border-line bg-bg-card p-6 transition-colors hover:border-line-2 max-[560px]:grid-cols-1"
    >
      {member.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.photoUrl}
          alt={member.name}
          className="h-[196px] w-[156px] rounded-xl border border-line object-cover object-top max-[560px]:h-[160px] max-[560px]:w-full"
        />
      ) : (
        <div className="flex h-[196px] w-[156px] items-center justify-center rounded-xl border border-line bg-bg-alt text-4xl font-semibold text-ink-4 max-[560px]:h-[160px] max-[560px]:w-full">
          {member.initials}
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <div className="mb-1 flex flex-wrap items-center gap-2.5">
          <span className="text-title text-ink">{member.name}</span>
          {member.isVerified && (
            <svg
              width="18"
              height="18"
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
          )}
          {tierBadge && (
            <span className="inline-flex flex-none items-center gap-1 rounded-full border border-[#86EFAC] bg-[#F0FDF4] px-2.5 py-[3px] text-[11px] font-semibold text-[#166534]">
              🌱 {tierBadge}
            </span>
          )}
        </div>

        <p className="mb-3 truncate text-sm text-ink-3">{roleText}</p>

        <div className="mb-4 flex flex-wrap items-center gap-0 text-[13px] text-ink-2">
          {location && (
            <span className="mr-3.5 flex items-center gap-1.5 border-r border-line-2 pr-3.5">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-ink-4">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0116 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {location}
            </span>
          )}
          <span className="mr-3.5 flex items-center gap-1.5 border-r border-line-2 pr-3.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-none text-ink-4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
            {member.yearsOfExperience}y exp.
          </span>
          <span className="font-semibold text-ink">
            {formatRate(member.rateMinCents, member.rateMaxCents, member.rateCurrency)}
          </span>
        </div>

        {member.bio && <p className="mb-[18px] line-clamp-2 text-sm leading-relaxed text-ink-3">{member.bio}</p>}

        <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-line pt-4">
          {visiblePracticeAreas.map((area) => (
            <Badge key={area.id} variant="neutral" className="font-bold">
              {area.name}
            </Badge>
          ))}
          <Button
            size="sm"
            disabled
            aria-disabled="true"
            title="Coming soon — consultations aren't live yet"
            className="ml-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            Request Consultation
          </Button>
        </div>
      </div>
    </Link>
  );
}
