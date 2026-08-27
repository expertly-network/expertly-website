import { Card, Button } from '@/components/ui';
import { formatRate } from '@/lib/members/format';
import { computeCompletionPct } from '@/lib/members/completion';
import type { MemberDto } from '@shared/member';

// Matches design/static_html/member-profile.html's `.mp-sidebar` order exactly: profile
// completeness (owner-only) → consultation fee + CTA → "Expertly Verified" card (bg-ink,
// glow blob — same dark-card language used elsewhere: DirectorySidebar's second card,
// Newsletter, Testimonials).
export function ProfileSidebar({
  member,
  isOwnProfile,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
}) {
  const pct = isOwnProfile ? computeCompletionPct(member) : null;

  return (
    <aside className="sticky top-24 w-[288px] flex-none flex-col gap-4 flex max-[1023px]:static max-[1023px]:w-full">
      {isOwnProfile && pct !== null && (
        <Card>
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-semibold tracking-[0.08em] text-ink-3">
              PROFILE COMPLETENESS
            </span>
            <span className="font-mono text-[13px] font-bold text-accent">{pct}%</span>
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-bg-alt">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-4">
            Changes you submit go live once the Expertly team verifies them.
          </p>
        </Card>
      )}

      <Card>
        <span className="font-mono text-[10px] font-semibold tracking-[0.08em] text-ink-3">
          CONSULTATION FEE
        </span>
        <div className="mb-4 mt-1 text-2xl font-bold tracking-[-0.02em] text-ink">
          {formatRate(member.rateMinCents, member.rateMaxCents, member.rateCurrency)}
        </div>
        <div
          className={`mb-2 flex items-center gap-1.5 text-[13px] font-medium ${
            member.isAvailable ? 'text-[#16a34a]' : 'text-ink-3'
          }`}
        >
          <span
            className={`h-[7px] w-[7px] flex-none rounded-full ${member.isAvailable ? 'bg-[#16a34a]' : 'bg-ink-4'}`}
          />
          {member.isAvailable ? 'Available for consultations' : 'Not currently available'}
        </div>
        {member.availabilityNotes && (
          <p className="mb-4 text-[13px] leading-relaxed text-ink-3">{member.availabilityNotes}</p>
        )}
        <Button disabled aria-disabled="true" title="Coming soon" fullWidth>
          Request Consultation
        </Button>
        {member.firmWebsite && (
          <a
            href={member.firmWebsite}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-[13px] text-ink-2 hover:underline"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M6 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M9 2h5v5M14 2L8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Company website
          </a>
        )}
      </Card>

      {member.isVerified && (
        <Card className="relative overflow-hidden bg-ink">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
            style={{
              background:
                'radial-gradient(circle, color-mix(in oklab, var(--accent) 18%, transparent) 0%, transparent 70%)',
            }}
          />
          <div className="relative mb-2.5 flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2.4 5H20l-4.5 3.5 1.7 5.5L12 13l-5.2 3 1.7-5.5L4 7h5.6L12 2z" fill="var(--accent)" />
              <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-white/90">
              Expertly Verified
            </span>
          </div>
          <p className="relative text-sm leading-relaxed text-white/60">
            {member.name}&apos;s credentials, employment history, and identity have been verified
            by the Expertly team.
          </p>
        </Card>
      )}
    </aside>
  );
}
