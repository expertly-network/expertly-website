import Link from 'next/link';
import type { ReactNode } from 'react';
import type { LearningDto, PerkDto, TemplateDto, TemplateFileType } from '@shared/resource';
import { Button } from '@/components/ui';
import { ResourceImage } from '@/components/resources/ResourceImage';

const FILE_LABEL: Record<TemplateFileType, string> = {
  docx: 'Word',
  xlsx: 'Excel',
  pptx: 'PowerPoint',
  pdf: 'PDF',
};
const FILE_TYPES: TemplateFileType[] = ['pptx', 'docx', 'xlsx', 'pdf'];

function Chip({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <span
      className={`absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${dark ? 'border border-white/20 bg-ink/70 text-bg backdrop-blur' : 'bg-ink text-bg'}`}
    >
      {children}
    </span>
  );
}

function Rows({ rows, empty }: { rows: { key: string; title: string; detail: string }[]; empty: string }) {
  return rows.length ? (
    <ul className="divide-y divide-line px-5">
      {rows.map((r) => (
        <li key={r.key} className="flex items-center gap-3 py-3.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{r.title}</span>
            <span className="mt-0.5 block truncate text-xs text-ink-3">{r.detail}</span>
          </span>
          <span
            aria-hidden="true"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full border border-line text-xs text-ink-3 transition-colors group-hover:border-ink group-hover:text-ink"
          >
            →
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="px-5 py-6 text-sm text-ink-3">{empty}</p>
  );
}

const featuredFirst = <T extends { isFeatured: boolean; sortOrder: number }>(items: T[]) =>
  [...items].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder);

// dashboard.html's "Your resources": Learnings, Templates and Perks share one card — a full-width
// picture with a label, then the first two items. Each card opens its library page (the libraries
// have no per-item URLs). `null` means that list failed to load.
export function DashboardResources({
  learnings,
  templates,
  perks,
}: {
  learnings: LearningDto[] | null;
  templates: TemplateDto[] | null;
  perks: PerkDto[] | null;
}) {
  const unavailable = 'Temporarily unavailable. Refresh to try again.';
  const videos = learnings ? featuredFirst(learnings).slice(0, 2) : [];
  const files = templates ? featuredFirst(templates).slice(0, 2) : [];
  const offers = perks ? featuredFirst(perks).slice(0, 3) : [];
  const cover = videos[0];

  return (
    <section aria-labelledby="dashboard-resources-title">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="dashboard-resources-title" className="text-title text-ink">
          Your resources
        </h2>
        <p className="text-caption text-ink-3">Make the most of your membership</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3 xl:gap-6">
        <Link
          href="/learnings"
          className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-bg-card transition-colors hover:border-line-2"
        >
          <div className="relative aspect-[16/10] bg-ink">
            <Chip dark>Continue learning</Chip>
            {cover ? (
              <>
                <ResourceImage src={cover.thumbnailUrl} className="h-full w-full object-cover opacity-90" />
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-bg/90 text-ink shadow-panel transition-transform group-hover:scale-105"
                >
                  ▶
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 to-transparent px-4 pb-3 pt-8 text-sm font-semibold text-bg">
                  <span className="line-clamp-1">{cover.title}</span>
                </span>
              </>
            ) : null}
          </div>
          <Rows
            rows={videos.map((v) => ({
              key: v.id,
              title: v.title,
              detail: [v.category, v.durationMinutes ? `${v.durationMinutes} min` : null].filter(Boolean).join(' · '),
            }))}
            empty={learnings === null ? unavailable : 'New learnings are on the way.'}
          />
        </Link>

        <Link
          href="/templates"
          className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-bg-card transition-colors hover:border-line-2"
        >
          <div className="relative flex aspect-[16/10] items-center justify-center gap-3 bg-bg-alt px-6">
            <Chip>Templates for you</Chip>
            {FILE_TYPES.map((type, i) => (
              <span
                key={type}
                className={`flex h-14 w-11 flex-col justify-end rounded-md bg-bg-card p-1.5 shadow-panel ring-1 ring-black/5 transition-transform group-hover:-translate-y-0.5 ${i % 2 ? 'translate-y-2' : ''}`}
              >
                <span className="mb-auto space-y-1 pt-1">
                  <span className="block h-0.5 w-full rounded-full bg-line" />
                  <span className="block h-0.5 w-3/4 rounded-full bg-line" />
                  <span className="block h-0.5 w-5/6 rounded-full bg-line" />
                </span>
                <span className="text-[9px] font-semibold uppercase text-ink">.{type}</span>
              </span>
            ))}
          </div>
          <Rows
            rows={files.map((t) => ({
              key: t.id,
              title: t.title,
              detail: `${FILE_LABEL[t.fileType]} · .${t.fileType}`,
            }))}
            empty={templates === null ? unavailable : 'New templates are on the way.'}
          />
        </Link>

        <Link
          href="/perks"
          className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-bg-card transition-colors hover:border-line-2"
        >
          <div className="relative flex aspect-[16/10] items-center justify-center gap-3 overflow-hidden bg-ink px-5">
            <Chip dark>Perks &amp; products</Chip>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-16 -right-12 h-48 w-48 rounded-full"
              style={{
                background:
                  'radial-gradient(closest-side, color-mix(in oklab, var(--accent) 35%, transparent), transparent)',
              }}
            />
            {offers.map((p) => (
              <span
                key={p.id}
                className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-bg-card p-2.5 shadow-panel transition-transform group-hover:-translate-y-0.5"
              >
                {p.logoUrl ? (
                  <ResourceImage
                    src={p.logoUrl}
                    alt={p.name}
                    width={64}
                    height={64}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-lg font-semibold text-ink">{p.name.slice(0, 1)}</span>
                )}
              </span>
            ))}
          </div>
          <Rows
            rows={offers.slice(0, 2).map((p) => ({ key: p.id, title: p.name, detail: p.tagline || p.category }))}
            empty={perks === null ? unavailable : 'New member perks are on the way.'}
          />
        </Link>
      </div>
    </section>
  );
}

const PEER_STAGES = [
  { title: 'Set preferences', detail: 'Who you’d like to meet' },
  { title: 'Matching', detail: 'Start of the cycle' },
  { title: 'Meet your peer', detail: 'See their profile' },
  { title: 'Meeting day', detail: 'A short call' },
  { title: 'Transcript & feedback', detail: 'After the call' },
];

// The prototype's monthly peer banner. Peer Connect isn't built yet, so this shows how a cycle
// will work (no match, dates or peer) and points to the member directory in the meantime.
export function DashboardPeerNetwork() {
  return (
    <section
      className="relative overflow-hidden rounded-card bg-ink p-6 text-bg sm:p-8"
      aria-labelledby="dashboard-peer-title"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full"
        style={{
          background: 'radial-gradient(closest-side, color-mix(in oklab, var(--accent) 32%, transparent), transparent)',
        }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/80">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            Peer Connect · Coming soon
          </span>
          <h2 id="dashboard-peer-title" className="mt-3 text-title text-bg">
            Meet a new peer every month
          </h2>
          <p className="mt-1.5 text-sm text-white/60">
            We&apos;ll match you with a verified member whose practice complements yours, for one short call a cycle.
          </p>
        </div>
        <Button href="/members" size="sm" variant="secondary-dark">
          Explore members →
        </Button>
      </div>
      <ol className="relative mt-6 grid gap-2 border-t border-white/10 pt-4 sm:grid-cols-5 sm:gap-3">
        {PEER_STAGES.map((s, i) => (
          <li key={s.title} className="flex min-w-0 items-center gap-2.5 rounded-xl px-1 py-1.5">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-white/25 text-[11px] font-semibold text-white/70">
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-bg">{s.title}</span>
              <span className="block truncate text-[11px] text-white/50">{s.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
