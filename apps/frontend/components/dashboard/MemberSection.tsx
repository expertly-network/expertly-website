import Image from 'next/image';
import Link from 'next/link';
import type { MemberListItemDto } from '@shared/member';
export function MemberSection({
  title,
  members,
  error,
  joinDates,
}: {
  title: string;
  members: MemberListItemDto[];
  error?: string;
  joinDates?: Record<string, string>;
}) {
  return (
    <section
      className="rounded-card border border-line bg-bg-card p-5 sm:p-6"
      aria-label={title}
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-title text-ink">{title}</h2>
        <Link
          href="/members"
          className="text-sm font-medium text-accent hover:underline"
        >
          Browse all <span aria-hidden="true">→</span>
        </Link>
      </div>
      {error ? (
        <p className="py-6 text-sm text-ink-3">{error}</p>
      ) : !members.length ? (
        <p className="py-6 text-sm text-ink-3">
          More members will appear here as the community grows.
        </p>
      ) : (
        <div
          className={
            members.length < 3
              ? 'grid gap-3 sm:grid-cols-2'
              : 'grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 lg:grid-cols-4'
          }
        >
          {members.map((member) => {
            const href = `/members/${member.slug}`;
            const joined = joinDates?.[member.id];
            const days = joined
              ? Math.max(
                  0,
                  Math.floor((Date.now() - Date.parse(joined)) / 86400000),
                )
              : null;
            const joinedLabel =
              days === null
                ? null
                : days === 0
                  ? 'Joined today'
                  : days === 1
                    ? 'Joined yesterday'
                    : days < 7
                      ? `Joined ${days} days ago`
                      : days < 30
                        ? `Joined ${Math.floor(days / 7)} ${days < 14 ? 'week' : 'weeks'} ago`
                        : `Joined ${new Date(joined!).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
            return (
              <Link
                key={member.id}
                href={href}
                aria-label={`View ${member.name}'s profile`}
                className={`group flex min-w-0 rounded-xl px-3 py-3 transition-colors hover:bg-bg-alt focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${members.length < 3 ? 'flex-row items-center gap-4 text-left' : 'flex-col items-center text-center'}`}
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neon text-sm font-medium text-ink">
                  {member.photoUrl ? (
                    <Image
                      unoptimized
                      width={56}
                      height={56}
                      src={member.photoUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    member.initials
                  )}
                </span>
                <div
                  className={
                    members.length < 3
                      ? 'min-w-0'
                      : 'mt-3 flex flex-1 flex-col items-center'
                  }
                >
                  <h3 className="text-sm font-semibold leading-snug text-ink group-hover:text-accent">
                    {member.name}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-ink-3">
                    {member.headline || member.firmName || 'GrowXQ member'}
                  </p>
                  <p className="mt-2 text-xs text-ink-3">
                    {joinedLabel || member.country || 'Community member'}
                  </p>
                  <span className="mt-auto pt-3 text-xs font-medium text-accent">
                    View profile <span aria-hidden="true">↗</span>
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
