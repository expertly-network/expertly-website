import type { MemberDto, MemberListItemDto } from '@shared/member';
import { Card } from '@/components/ui';
import { SignInButton, SignInLink } from '@/components/auth/SignInLink';
import { PageContainer } from '@/components/layout/PageContainer';
import { LockIcon, SignInGate, TeaserFade } from '@/components/shared/LockedContent';
import { formatRateParts } from '@/lib/members/format';
import { ProfileHeader } from './ProfileHeader';

// Same labels as ProfileTabs, so the signed-out page reads as the real profile with the detail locked.
const LOCKED_TABS = ['Credentials', 'Articles', 'Reviews & Recognition', 'Contact Information'];

// `.mp-sidebar-label`
const LABEL = 'font-mono text-[10px] font-semibold text-ink-3';

// Signed-out view of a member profile, built only from the public directory preview
// (GET /members/:slug/preview): header, a bio teaser, and the consultation fee. Everything else
// sits behind sign-in.
export function ProfileAuthWall({ member }: { member: MemberListItemDto }) {
  const firstName = member.name.split(' ')[0];
  const rate = formatRateParts(member.rateMinCents, member.rateMaxCents, member.rateCurrency);
  const preview: MemberDto = {
    ...member,
    firmWebsite: null,
    availabilityNotes: null,
    isAvailable: false,
    contactEmail: null,
    workEmail: null,
    contactPhone: null,
    linkedinUrl: null,
    contactVisible: false,
    website: null,
    workExperiences: [],
    educations: [],
    engagements: [],
    qualifications: [],
    credentials: [],
    testimonials: [],
    awards: [],
    keyClients: [],
    interviewVerified: false,
    serviceSubtags: [],
  };

  return (
    <PageContainer className="pb-20 pt-10 max-[720px]:pt-5">
      <ProfileHeader member={preview} canDownloadPdf={false} />

      <div className="mt-4 flex items-start gap-6 max-[1023px]:flex-col">
        <div className="min-w-0 flex-1 max-[1023px]:w-full">
          {/* Mirrors ProfileTabs' bar; locked tabs send the visitor to sign in. */}
          <nav
            aria-label="Profile sections"
            className="-mx-5 mb-4 overflow-hidden border-y border-line bg-bg-card sm:mx-0 sm:rounded-panel sm:border sm:shadow-panel"
          >
            <div className="flex overflow-x-auto px-2 sm:px-0">
              <span
                aria-current="page"
                className="flex-none whitespace-nowrap border-b-2 border-ink-2 px-3 py-3.5 font-mono sm:px-5 text-profile-item font-medium text-ink"
              >
                About
              </span>
              {LOCKED_TABS.map((label) => (
                <SignInLink
                  key={label}
                  title={`Sign in to view ${label}`}
                  className="inline-flex flex-none items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-3.5 font-mono text-profile-item font-medium text-ink-4 sm:px-5 transition-colors hover:text-ink-2"
                >
                  <LockIcon size={13} />
                  {label}
                </SignInLink>
              ))}
            </div>
          </nav>

          {/* Phones: no panel frame, like ProfileTabs. */}
          <div className="sm:rounded-panel sm:border sm:border-line sm:bg-bg-card sm:p-6 sm:shadow-panel">
            {member.bio && (
              <div>
                <div className="mb-3 font-mono text-profile-label font-semibold text-ink-3">About</div>
                <TeaserFade>
                  <p className="whitespace-pre-line text-profile-body text-ink-2">{member.bio}</p>
                </TeaserFade>
              </div>
            )}
            <SignInGate
              className={member.bio ? '-mt-4' : undefined}
              eyebrow="Locked profile"
              title={`See ${firstName}’s full story.`}
              description="Sign in to see their experience, credentials and work, and get in touch directly."
              perks={['Work history', 'Credentials & reviews', 'Contact details']}
              buttonLabel="Sign in to view profile"
            />
          </div>
        </div>

        <aside className="sticky top-24 flex w-[288px] flex-none flex-col gap-4 max-[1023px]:static max-[1023px]:w-full">
          <Card padding="sm" className="shadow-panel">
            <div className={`${LABEL} mb-1`}>Consultation Fee</div>
            <div className="mb-4 text-title font-semibold text-ink">
              {rate ? (
                <>
                  {rate.min}
                  {rate.max && <> – {rate.max}</>}
                  <span className="text-caption font-normal text-ink-3"> / hr</span>
                </>
              ) : (
                'Rate on request'
              )}
            </div>
            <SignInButton fullWidth className="font-mono font-semibold">
              <LockIcon size={14} />
              Sign in to request
            </SignInButton>
            <p className="mt-3 text-center text-caption text-ink-4">You’ll come straight back to this profile.</p>
          </Card>
        </aside>
      </div>
    </PageContainer>
  );
}
