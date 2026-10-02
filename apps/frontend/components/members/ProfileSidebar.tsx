import { Card, Button } from '@/components/ui';
import { displayHost, formatRateParts } from '@/lib/members/format';
import { computeCompletionPct } from '@/lib/members/completion';
import type { MemberDto } from '@shared/member';

// `.mp-sidebar-label`
const LABEL = 'font-mono text-[10px] font-semibold tracking-[0.08em] text-ink-3';

export function ProfileSidebar({
  member,
  isOwnProfile,
  onRequestConsultation,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
  onRequestConsultation: () => void;
}) {
  const pct = isOwnProfile ? computeCompletionPct(member) : null;
  const rate = formatRateParts(member.rateMinCents, member.rateMaxCents, member.rateCurrency);

  return (
    // `.mp-sidebar` — 288px, sticky; stacks full-width under the tabs below 1024px.
    <aside className="sticky top-24 flex w-[288px] flex-none flex-col gap-4 max-[1023px]:static max-[1023px]:w-full">
      {isOwnProfile && pct !== null && (
        <Card padding="sm" className="shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between">
            <span className={LABEL}>Profile completeness</span>
            <span className="font-mono text-caption font-bold text-accent">{pct}%</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-bg-alt">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-4">
            Changes you submit go live once the Expertly team verifies them.
          </p>
        </Card>
      )}

      <Card padding="sm" className="shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
        <div className={`${LABEL} mb-1`}>Consultation Fee</div>
        {/* `.mp-fee-main` / `.mp-fee-max` / `.mp-fee-hr` */}
        <div className="mb-4 text-2xl font-bold tracking-[-0.02em] text-ink">
          {rate ? (
            <>
              {rate.min}
              {rate.max && <span className="text-base font-semibold"> – {rate.max}</span>}
              <span className="text-profile-item font-normal tracking-normal text-ink-3"> / hr</span>
            </>
          ) : (
            'Rate on request'
          )}
        </div>
        <div
          className={`mb-2 flex items-center gap-1.5 text-caption font-medium ${
            member.isAvailable ? 'text-[#16a34a]' : 'text-ink-3'
          }`}
        >
          <span
            className={`h-2 w-2 flex-none rounded-full ${member.isAvailable ? 'bg-[#16a34a]' : 'bg-ink-4'}`}
          />
          {member.isAvailable ? 'Available for consultations' : 'Currently unavailable'}
        </div>
        {member.availabilityNotes && (
          <p className="mb-4 text-caption leading-relaxed text-ink-3">{member.availabilityNotes}</p>
        )}
        {!isOwnProfile && (
          <Button onClick={onRequestConsultation} fullWidth className="font-mono font-semibold">
            Request Consultation
          </Button>
        )}
        {member.firmWebsite && (
          // `.mp-firm-link`
          <a
            href={member.firmWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center gap-1.5 border-t border-line pt-3 text-caption text-ink-2 hover:underline"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="flex-none">
              <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 2h5v5M14 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex-none">Company website</span>
            <span className="min-w-0 truncate text-ink-4">· {displayHost(member.firmWebsite)}</span>
          </a>
        )}
      </Card>

      {member.isVerified && (
        // `.mp-verified-card`
        <Card padding="sm" className="relative overflow-hidden bg-ink">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_oklab,var(--accent)_18%,transparent)]"
          />
          <div className="relative mb-2.5 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2l2.4 5H20l-4.5 3.5 1.7 5.5L12 13l-5.2 3 1.7-5.5L4 7h5.6L12 2z" fill="var(--accent)" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-white/90">
              Expertly Verified
            </span>
          </div>
          <p className="relative text-sm leading-[1.55] text-white/60">
            {member.name}&apos;s credentials, employment history, and identity have been verified
            by the Expertly team.
          </p>
        </Card>
      )}
    </aside>
  );
}
