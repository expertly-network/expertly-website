'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button } from '@/components/ui';
import { SECTION_TITLES } from '@/components/members/edit/sectionFieldConfig';
import { setContactVerified, setItemVerified, setProfileVerified } from '@/lib/api/member-verification';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import { formatDate } from '@/lib/dates';
import type { AdminMemberVerificationDetailDto, MemberEditSection, ProofAttachment } from '@shared/member';

type Item = {
  id: string;
  isVerified: boolean;
  changedAt?: string | null;
  verifiedAt?: string | null;
  proofAttachments?: ProofAttachment[];
} & Record<string, unknown>;

type SectionKey = (typeof ITEM_SECTIONS)[number];

const ITEM_SECTIONS = [
  'engagements',
  'work_experiences',
  'education',
  'key_clients',
  'testimonials',
  'awards',
] as const satisfies readonly MemberEditSection[];

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const num = (v: unknown) => (typeof v === 'number' ? String(v) : '');

// The title and supporting lines an admin needs to judge one entry.
function describe(section: SectionKey, item: Item): { title: string; lines: string[] } {
  const join = (...parts: string[]) => parts.filter(Boolean).join(' · ');
  switch (section) {
    case 'engagements':
      return {
        title: str(item.title) || 'Untitled engagement',
        lines: [
          join(
            item.isConfidential === true ? 'Confidential client' : str(item.clientName),
            item.isConfidential === true ? `(${str(item.clientName)})` : '',
            num(item.year)
          ),
        ],
      };
    case 'work_experiences':
      return {
        title: str(item.title) || 'Role',
        lines: [
          join(num(item.startYear), item.isCurrent === true ? 'Present' : num(item.endYear) || '').replace(
            ' · ',
            ' – '
          ),
        ],
      };
    case 'education':
      return {
        title: join(str(item.degree), str(item.field)) || 'Education',
        lines: [join(str(item.institution), num(item.endYear))],
      };
    case 'key_clients':
      return { title: str(item.name) || 'Client', lines: [] };
    case 'testimonials':
      return {
        title: `“${str(item.quote)}”`,
        lines: [join(str(item.clientName), str(item.clientTitle), str(item.clientCompany))],
      };
    case 'awards':
      return {
        title: str(item.title) || 'Award',
        lines: [join(str(item.issuingBody), num(item.year)), str(item.description)],
      };
  }
}

// ── status ────────────────────────────────────────────────────────────────────────────────────
// A pending entry is either brand new, or was verified once and has been changed since.
type Status = 'new' | 'changed' | 'verified';

const STATUS_PILL: Record<Status, { label: string; variant: 'warning' | 'success' }> = {
  new: { label: 'New — needs review', variant: 'warning' },
  changed: { label: 'Changed since verified', variant: 'warning' },
  verified: { label: 'Verified', variant: 'success' },
};
// When a company has several roles, the group shows the status that most needs attention.
const PRIORITY: Status[] = ['changed', 'new', 'verified'];

function statusOf(item: Item): Status {
  if (item.isVerified) return 'verified';
  return item.verifiedAt ? 'changed' : 'new';
}

// Work experience is verified per company: consecutive roles at one company are one entry.
function groupItems(section: SectionKey, items: Item[]): Item[][] {
  if (section !== 'work_experiences') return items.map((i) => [i]);
  const groups: Item[][] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && str(last[0].company).toLowerCase() === str(item.company).toLowerCase()) last.push(item);
    else groups.push([item]);
  }
  return groups;
}

function groupStatus(group: Item[]): Status {
  const statuses = group.map(statusOf);
  return PRIORITY.find((s) => statuses.includes(s)) ?? 'verified';
}

const when = (iso: string | null | undefined) => (iso ? formatDate(iso) : null);

// ── small pieces ──────────────────────────────────────────────────────────────────────────────
function ProofList({ attachments, fileUrls }: { attachments: ProofAttachment[]; fileUrls: Record<string, string> }) {
  if (attachments.length === 0) return <p className="text-xs text-ink-3">No proof attached.</p>;
  return (
    <ul className="flex flex-col gap-1">
      {attachments.map((a, i) => {
        const href = a.type === 'file' ? fileUrls[a.url] : a.url;
        return (
          <li key={i} className="truncate text-xs">
            {a.type === 'file' ? '📎 ' : '🔗 '}
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent hover:underline"
              >
                {a.label}
              </a>
            ) : (
              <span className="text-ink-3">{a.label} (link unavailable)</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone?: 'warn' }) {
  return (
    <div className="min-w-[110px] flex-1 rounded-panel border border-line bg-bg-card px-4 py-3">
      <div className={`text-2xl font-semibold tabular-nums ${tone === 'warn' && value > 0 ? 'text-warn' : 'text-ink'}`}>
        {value}
      </div>
      <div className="text-xs text-ink-3">{label}</div>
    </div>
  );
}

function SectionCard({
  title,
  chips,
  action,
  defaultOpen,
  children,
}: {
  title: string;
  chips: ReactNode;
  action?: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-panel border border-line bg-bg-card">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-2 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="flex-none text-ink-3 transition-transform group-open:rotate-90"
        >
          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2 className="text-title font-semibold text-ink">{title}</h2>
        <span className="flex flex-wrap items-center gap-2">{chips}</span>
        {action && (
          <span className="ml-auto" onClick={(e) => e.preventDefault()}>
            {action}
          </span>
        )}
      </summary>
      <div className="flex flex-col gap-3 border-t border-line p-4 sm:p-5">{children}</div>
    </details>
  );
}

function SectionChips({ review, total }: { review: number; total: number }) {
  if (total === 0) return <span className="text-xs text-ink-3">Nothing listed</span>;
  return review > 0 ? (
    <Badge variant="warning">{review} to review</Badge>
  ) : (
    <Badge variant="success">All verified</Badge>
  );
}

export function MemberVerification({ detail }: { detail: AdminMemberVerificationDetailDto }) {
  const router = useRouter();
  const { member, current, contactVerified, fileUrls } = detail;
  const firstName = member.name.split(' ')[0] || 'The member';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(apiErrorMessage(err, 'That did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  // Contact: one verified flag for the block, so it is a single entry.
  const contact = current.contact;
  const contactRows: [string, string | null | undefined][] = [
    ['Work email', contact.workEmail],
    ['Phone', contact.contactPhone],
    ['LinkedIn', contact.linkedinUrl],
    ['Website', contact.website],
  ];
  const hasContact = contactRows.some(([, v]) => v);
  const contactStatus: Status = contactVerified ? 'verified' : 'new';

  // Totals for the strip at the top: every entry (a company counts once), plus the contact block.
  const sections = ITEM_SECTIONS.map((section) => {
    const items = (current[section] as unknown as Item[]) ?? [];
    return { section, groups: groupItems(section, items).map((group) => ({ group, status: groupStatus(group) })) };
  });
  const allStatuses: Status[] = [
    ...(hasContact ? [contactStatus] : []),
    ...sections.flatMap((s) => s.groups.map((g) => g.status)),
  ];
  const pending = allStatuses.filter((s) => s !== 'verified').length;
  const verified = allStatuses.length - pending;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div role="alert" className="rounded-input border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Where this member stands: counts, and the final whole-profile decision. */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Stat value={pending} label="To review" tone="warn" />
          <Stat value={verified} label="Verified" />
          <Stat value={allStatuses.length} label="Entries in total" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-bg-card px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">GrowXQ Verified badge</span>
              <Badge variant={member.isVerified ? 'success' : 'neutral'}>
                {member.isVerified ? 'Given' : 'Not given'}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-ink-3">
              {pending > 0
                ? `Shown on the profile only when everything is verified — ${pending} ${pending === 1 ? 'entry is' : 'entries are'} still pending.`
                : member.isVerified
                  ? 'Everything is verified, so the badge and the tick on the photo are showing.'
                  : 'Everything is verified. Give the badge to show it on the profile.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/members/${member.slug}`}
              className="inline-flex items-center rounded-input border border-line-2 px-3.5 py-2 text-sm font-medium text-ink hover:border-ink"
            >
              View public profile
            </Link>
            <Button
              size="sm"
              variant={member.isVerified ? 'secondary' : 'primary'}
              disabled={busy || (!member.isVerified && pending > 0)}
              onClick={() => run(() => setProfileVerified(member.id, { verified: !member.isVerified }))}
            >
              {member.isVerified ? 'Remove badge' : 'Give badge'}
            </Button>
          </div>
        </div>
        <p className="text-xs text-ink-3">
          {firstName} sees “Pending Verification” on anything not yet verified, with a prompt to add proof so it can be
          verified faster. There is nothing to send — verify an entry once you are satisfied with it.
        </p>
      </div>

      <SectionCard
        title={SECTION_TITLES.contact}
        defaultOpen={contactStatus !== 'verified' && hasContact}
        chips={
          hasContact ? (
            <Badge variant={STATUS_PILL[contactStatus].variant}>{STATUS_PILL[contactStatus].label}</Badge>
          ) : (
            <span className="text-xs text-ink-3">Nothing listed</span>
          )
        }
      >
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {contactRows.map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <dt className="w-24 flex-none text-ink-3">{label}</dt>
              <dd className="min-w-0 truncate text-ink">{value || '—'}</dd>
            </div>
          ))}
        </dl>
        <div>
          <Button
            size="sm"
            variant={contactVerified ? 'secondary' : 'primary'}
            disabled={busy}
            onClick={() => run(() => setContactVerified(member.id, { verified: !contactVerified }))}
          >
            {contactVerified ? 'Un-verify' : 'Verify contact'}
          </Button>
        </div>
      </SectionCard>

      {sections.map(({ section, groups }) => {
        const open = groups.filter((g) => g.status !== 'verified');
        const done = groups.filter((g) => g.status === 'verified');
        const pendingItems = open.flatMap((g) => g.group);
        const isWork = section === 'work_experiences';
        const name = (item: Item) => (isWork ? str(item.company) || 'Company' : describe(section, item).title);
        const latest = (dates: (string | null | undefined)[]) => dates.filter(Boolean).sort().at(-1);
        return (
          <SectionCard
            key={section}
            title={SECTION_TITLES[section]}
            defaultOpen={open.length > 0}
            chips={<SectionChips review={open.length} total={groups.length} />}
            action={
              pendingItems.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      Promise.all(
                        pendingItems.map((i) => setItemVerified(member.id, section, i.id, { verified: true }))
                      )
                    )
                  }
                >
                  Verify all pending
                </Button>
              )
            }
          >
            {groups.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing listed.</p>
            ) : (
              <>
                {open.map(({ group, status }) => {
                  const item = group[0];
                  const pill = STATUS_PILL[status];
                  const changedAt = latest(group.map((i) => i.changedAt));
                  const verifiedAt = latest(group.map((i) => i.verifiedAt));
                  return (
                    <article key={item.id} className="rounded-xl border border-line p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink">{name(item)}</p>
                          {isWork
                            ? group.map((role) => (
                                <p key={role.id} className="mt-0.5 text-sm text-ink-3">
                                  {describe(section, role).title} · {describe(section, role).lines[0]}
                                </p>
                              ))
                            : describe(section, item)
                                .lines.filter(Boolean)
                                .map((line, i) => (
                                  <p key={i} className="mt-0.5 text-sm text-ink-3">
                                    {line}
                                  </p>
                                ))}
                          <p className="mt-1.5 text-xs text-ink-4">
                            {changedAt
                              ? `${verifiedAt ? 'Changed' : 'Added'} ${when(changedAt)}`
                              : 'Added before change tracking'}
                            {verifiedAt && ` · last verified ${when(verifiedAt)}`}
                          </p>
                        </div>
                        <Badge variant={pill.variant}>{pill.label}</Badge>
                      </div>
                      <div className="mt-3">
                        <ProofList attachments={group.flatMap((i) => i.proofAttachments ?? [])} fileUrls={fileUrls} />
                      </div>
                      <div className="mt-3">
                        <Button
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            run(() =>
                              Promise.all(
                                group.map((i) => setItemVerified(member.id, section, i.id, { verified: true }))
                              )
                            )
                          }
                        >
                          {isWork ? 'Verify company' : 'Verify'}
                        </Button>
                      </div>
                    </article>
                  );
                })}

                {done.length > 0 && (
                  <details className="rounded-xl bg-bg-alt">
                    <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink-2 [&::-webkit-details-marker]:hidden">
                      Verified ({done.length})
                    </summary>
                    <ul className="flex flex-col gap-2 px-4 pb-4">
                      {done.map(({ group }) => {
                        const item = group[0];
                        const verifiedAt = latest(group.map((i) => i.verifiedAt));
                        return (
                          <li
                            key={item.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-bg-card px-3.5 py-2.5"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink">{name(item)}</span>
                              <span className="block text-xs text-ink-4">
                                {verifiedAt ? `Verified ${when(verifiedAt)}` : 'Verified'}
                              </span>
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() =>
                                run(() =>
                                  Promise.all(
                                    group.map((i) => setItemVerified(member.id, section, i.id, { verified: false }))
                                  )
                                )
                              }
                            >
                              Un-verify
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}
