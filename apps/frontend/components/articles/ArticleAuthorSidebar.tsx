import Link from 'next/link';
import { Card } from '@/components/ui';
import { formatRate, formatTenure } from '@/lib/members/format';
import type { MemberDto } from '@shared/member';

// Matches design/static_html/article.html's "About the Author" box — but sourced from the
// real member profile (GET /v1/members/:id) rather than the prototype's separate hardcoded
// per-author bio object (docs/database-erd.md flags that duplication as a corner not to
// reproduce: the bio already lives on member_profiles, no second copy).
export function ArticleAuthorSidebar({ author }: { author: MemberDto }) {
  const location = [author.city, author.country].filter(Boolean).join(', ');
  const primaryPracticeArea = author.practiceAreas[0];

  return (
    <Card padding="md">
      <div className="mb-1 text-mono-label text-ink-3">About the author</div>
      <div className="mt-3 flex items-center gap-3">
        {author.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={author.photoUrl}
            alt={author.name}
            className="h-12 w-12 flex-none rounded-full border border-line object-cover"
          />
        ) : (
          <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-bg-alt text-sm font-semibold text-ink-4">
            {author.initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium text-ink">{author.name}</span>
            {author.isVerified && (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="flex-none text-ok"
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
          </div>
          <p className="truncate text-xs text-ink-3">
            {author.headline}
            {author.firmName ? ` · ${author.firmName}` : ''}
          </p>
          {location && <p className="text-xs text-ink-3">{location}</p>}
        </div>
      </div>

      <dl className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm">
        {primaryPracticeArea && (
          <div className="flex items-center justify-between">
            <dt className="text-ink-3">Practice area</dt>
            <dd className="font-semibold text-ink">{primaryPracticeArea.name}</dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt className="text-ink-3">Experience</dt>
          <dd className="font-semibold text-ink">{formatTenure(author.yearsOfExperience)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-3">Consultation rate</dt>
          <dd className="font-semibold text-ink">
            {formatRate(author.rateMinCents, author.rateMaxCents, author.rateCurrency)}
          </dd>
        </div>
      </dl>

      {author.bio && <p className="mt-4 line-clamp-4 text-sm text-ink-3">{author.bio}</p>}

      <Link href={`/members/${author.id}`} className="mt-4 block text-sm font-medium text-accent">
        View profile →
      </Link>
    </Card>
  );
}
