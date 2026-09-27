// Presentational rows shared by the applicant's own review step (ReviewSubmitStep) and the admin
// application review detail page (ApplicationReviewDetail) — both render the same "labeled row" /
// "labeled list of structured entries" layout over their own field mapping, so only the
// presentation lives here.

import { Badge, type BadgeVariant } from '@/components/ui';
import type { ApplicationStatus } from '@shared/membership-application';

export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
};

// Not a strict traffic-light (only 5 states, most of them not literally "good"/"bad") — draft and
// submitted just need to read as visually distinct from each other and from the two decided
// outcomes, hence warning/info rather than a second success/danger pair.
const STATUS_VARIANT: Record<ApplicationStatus, BadgeVariant> = {
  draft: 'warning',
  submitted: 'info',
  under_review: 'info',
  approved: 'success',
  rejected: 'danger',
};

// Shared by the admin queue table and the detail page so both status chips always agree.
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function ReviewRow({
  label,
  value,
  multiline,
  href,
}: {
  label: string;
  value: string;
  multiline?: boolean;
  href?: string;
}) {
  return (
    <div className={`grid grid-cols-[140px_1fr] gap-4 px-6 py-3.5 text-sm ${multiline ? 'items-start' : 'items-center'}`}>
      <span className="text-mono-label text-ink-3">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-accent underline hover:text-ink"
        >
          {value}
        </a>
      ) : (
        <span className={`text-ink ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value || '—'}</span>
      )}
    </div>
  );
}

// For fields that are a list of structured entries (work history, education, services, peer
// references) rather than a single value.
export function ReviewListRow({
  label,
  items,
}: {
  label: string;
  items: { title: string; detail?: string; link?: { href: string; label: string } }[];
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-4 px-6 py-3.5 text-sm">
      <span className="mt-0.5 text-mono-label text-ink-3">{label}</span>
      {items.length === 0 ? (
        <span className="text-ink">—</span>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item, i) => (
            <div key={i}>
              <div className="text-ink">{item.title}</div>
              {item.detail && <div className="mt-0.5 text-xs text-ink-3">{item.detail}</div>}
              {item.link && (
                <a
                  href={item.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-block text-xs text-accent underline hover:text-ink"
                >
                  {item.link.label}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
