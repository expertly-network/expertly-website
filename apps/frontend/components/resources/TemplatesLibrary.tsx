'use client';
import Image from 'next/image';
import { useState } from 'react';
import type { CollectionDto, TemplateDto, TemplateFileType } from '@shared/resource';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge, Button, Card, Input } from '@/components/ui';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import { getTemplateDownload } from '@/lib/api/resources';
import { ResourceHero } from './ResourceHero';
import { ResourceDialog } from './ResourceDialog';

const FILE_LABEL: Record<TemplateFileType, string> = {
  docx: 'Word',
  xlsx: 'Excel',
  pptx: 'PowerPoint',
  pdf: 'PDF',
};

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

const isTemplate = (item: CollectionDto['items'][number]): item is TemplateDto => 'fileType' in item;

// A template's first page as a sheet of paper. Falls back to a designed cover (file type on a
// tinted page with ruled lines) when there's no preview image or it fails to load.
function Paper({
  template,
  className = '',
  sizes = 640,
}: {
  template: Pick<TemplateDto, 'previewImageUrl' | 'fileType' | 'title'>;
  className?: string;
  sizes?: number;
}) {
  const [failed, setFailed] = useState(false);
  const landscape = template.fileType === 'xlsx' || template.fileType === 'pptx';
  return (
    <div
      className={`overflow-hidden rounded-md bg-white shadow-[0_1px_2px_rgba(11,11,12,0.06),0_12px_28px_-10px_rgba(11,11,12,0.28)] ring-1 ring-black/5 ${className}`}
    >
      {template.previewImageUrl && !failed ? (
        // unoptimized: an admin may point a preview at any https host, not only resource-assets.
        <Image
          unoptimized
          src={template.previewImageUrl}
          alt=""
          width={sizes}
          height={Math.round(sizes * (landscape ? 0.73 : 1.29))}
          className="h-full w-full object-cover object-left-top"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="flex h-full w-full flex-col gap-2 p-5">
          <span className="text-[10px] font-semibold uppercase text-accent">.{template.fileType}</span>
          <span className="line-clamp-2 text-sm font-semibold text-ink">{template.title}</span>
          {[90, 75, 82, 60, 70].map((w) => (
            <span key={w} className="h-1.5 rounded-full bg-line" style={{ width: `${w}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

// Fanned stack of up to three pages, for kits and the hero collage.
function PaperStack({ items, className = '' }: { items: TemplateDto[]; className?: string }) {
  const rotations = ['-rotate-6 -translate-x-8', 'rotate-0 z-10', 'rotate-6 translate-x-8'];
  const shown = items.slice(0, 3);
  return (
    <div className={`relative flex items-end justify-center ${className}`}>
      {shown.map((t, i) => (
        <Paper
          key={t.id}
          template={t}
          sizes={320}
          className={`absolute bottom-0 h-[90%] w-[44%] transition-transform duration-300 ${shown.length === 1 ? 'z-10' : rotations[i + (shown.length === 2 ? 1 : 0)]}`}
        />
      ))}
    </div>
  );
}

export function TemplatesLibrary({
  templates,
  kits,
  signedIn,
}: {
  templates: TemplateDto[];
  kits: CollectionDto[];
  signedIn: boolean;
}) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All templates');
  const [selected, setSelected] = useState<TemplateDto | null>(null);
  const [kit, setKit] = useState<CollectionDto | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const categories = ['All templates', ...Array.from(new Set(templates.map((t) => t.category)))];
  const filtered = templates
    .filter(
      (t) =>
        (category === 'All templates' || t.category === category) &&
        `${t.title} ${t.description} ${t.highlights.join(' ')} ${FILE_LABEL[t.fileType]}`
          .toLowerCase()
          .includes(q.toLowerCase())
    )
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.sortOrder - b.sortOrder);
  const visibleKits = kits.filter((k) => k.items.some(isTemplate));
  const heroPages = [
    templates.find((t) => t.fileType === 'docx'),
    templates.find((t) => t.fileType === 'xlsx'),
    templates.find((t) => t.fileType === 'pptx'),
  ].filter((t): t is TemplateDto => !!t);

  function open(t: TemplateDto) {
    setError('');
    setSelected(t);
  }

  async function download(t: TemplateDto) {
    setDownloading(true);
    setError('');
    try {
      // A fresh 60-second link per click; navigating to it starts the download (attachment).
      const { url } = await getTemplateDownload(t.id);
      window.location.assign(url);
    } catch (e) {
      setError(
        apiErrorMessage(e, 'The download couldn’t start. Please try again.', {
          TEMPLATE_MEMBERS_ONLY: 'Template downloads are for GrowXQ members.',
          TEMPLATE_NOT_FOUND: 'This template is no longer available.',
        })
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <ResourceHero
        title="Professional templates,"
        accent="ready to adapt."
        aside={
          heroPages.length > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-24 right-[5%] top-12 hidden w-[400px] xl:block"
            >
              <PaperStack items={heroPages} className="h-full" />
            </div>
          )
        }
        search={
          <Input
            id="template-search"
            type="search"
            label=""
            aria-label="Search templates"
            className="bg-bg-card"
            placeholder="Search templates, e.g. GST, NDA, audit…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      >
        Working papers, letters, workbooks and decks built for tax, legal and audit practitioners. Start from a solid
        structure instead of a blank page.
      </ResourceHero>

      <PageContainer className="py-8 sm:py-10">
        {visibleKits.length > 0 && (
          <section aria-labelledby="kits-heading" className="mb-12">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="mb-1 text-eyebrow text-accent">Start with a kit</p>
                <h2 id="kits-heading" className="text-heading">
                  Everything for the job, together.
                </h2>
              </div>
              <p className="text-sm text-ink-3">Curated sets of templates that work together.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleKits.map((k) => {
                const items = k.items.filter(isTemplate);
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKit(k)}
                    className="group min-w-0 overflow-hidden rounded-card border border-line bg-bg-card text-left transition-colors hover:border-line-2"
                  >
                    <div className="relative h-60 overflow-hidden bg-[color-mix(in_oklab,var(--accent)_8%,var(--bg-alt))] px-6 pt-5">
                      <PaperStack
                        items={items}
                        className="h-full translate-y-5 transition-transform duration-300 group-hover:translate-y-2"
                      />
                    </div>
                    <div className="p-5">
                      <span className="text-xs text-ink-3">
                        {items.length} {items.length === 1 ? 'template' : 'templates'} ·{' '}
                        {Array.from(new Set(items.map((t) => FILE_LABEL[t.fileType]))).join(', ')}
                      </span>
                      <h3 className="mt-1 text-title group-hover:text-accent">
                        {k.title} <span aria-hidden="true">↗</span>
                      </h3>
                      <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-3">{k.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <h2 className="mb-5 text-heading">Browse the library.</h2>
        <div role="group" aria-label="Template categories" className="mb-7 flex gap-2 overflow-x-auto pb-2">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-medium transition-colors ${category === c ? 'bg-ink text-white' : 'bg-bg-alt text-ink-3 hover:text-ink'}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-title">{category}</h2>
          <span aria-live="polite" className="text-xs text-ink-3">
            {filtered.length} {filtered.length === 1 ? 'template' : 'templates'}
          </span>
        </div>

        {!templates.length ? (
          <Card padding="md">
            <p className="text-sm text-ink-3">New templates are on the way. Check back soon.</p>
          </Card>
        ) : !filtered.length ? (
          <Card padding="md">
            <p className="text-sm text-ink-3">No templates match your search.</p>
            <Button
              variant="ghost"
              onClick={() => {
                setQ('');
                setCategory('All templates');
              }}
            >
              Clear filters
            </Button>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => open(t)}
                className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-bg-card text-left transition-colors hover:border-line-2"
              >
                <div className="relative aspect-[16/11] overflow-hidden bg-bg-alt px-7 pt-7">
                  <Paper
                    template={t}
                    sizes={480}
                    className="h-[118%] w-full transition-transform duration-300 group-hover:-translate-y-2"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold uppercase text-white">
                    {t.fileType}
                  </span>
                  {t.isFeatured && (
                    <span className="absolute right-4 top-4">
                      <Badge variant="surface">GrowXQ pick</Badge>
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs text-ink-3">
                    {t.category} · {FILE_LABEL[t.fileType]}
                  </p>
                  <h3 className="mt-1 text-title group-hover:text-accent">{t.title}</h3>
                  <p className="mt-2 line-clamp-2 text-sm text-ink-3">{t.description}</p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs">
                    <span className="text-ink-3">{formatSize(t.fileSizeBytes)}</span>
                    <span className="font-medium text-accent">{t.canDownload ? 'Download ↓' : 'Members only'}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </PageContainer>

      {kit && (
        <ResourceDialog title={kit.title} onClose={() => setKit(null)}>
          <p className="mb-5 text-sm text-ink-3">{kit.description}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {kit.items.filter(isTemplate).map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setKit(null);
                  open(item);
                }}
                className="group flex items-center gap-4 rounded-xl border border-line p-3 text-left hover:bg-bg-alt"
              >
                <Paper template={item} sizes={160} className="h-20 w-16 flex-none" />
                <span className="min-w-0">
                  <span className="text-xs text-ink-3">Step {i + 1}</span>
                  <strong className="block text-sm group-hover:text-accent">{item.title}</strong>
                  <span className="mt-0.5 block text-xs text-ink-3">
                    {FILE_LABEL[item.fileType]} · {formatSize(item.fileSizeBytes)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </ResourceDialog>
      )}

      {selected && (
        <ResourceDialog title={selected.title} onClose={() => setSelected(null)}>
          {!signedIn ? (
            // Guests can browse the cards; details and downloads need a sign-in.
            <div className="flex flex-col items-center gap-4 px-2 py-8 text-center">
              <Paper template={selected} sizes={240} className="h-44 w-36" />
              <h3 className="mt-2 text-title">You need to sign in to view this.</h3>
              <p className="max-w-[420px] text-sm leading-relaxed text-ink-3">
                Sign in or create a free account to see this template&apos;s details.
              </p>
              <Button href="/login?returnTo=/templates">Sign in</Button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex items-start justify-center rounded-xl bg-bg-alt p-5 sm:p-7">
                <Paper template={selected} sizes={640} className="max-h-[480px] w-full" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="brand">{selected.category}</Badge>
                  <span className="text-xs text-ink-3">
                    {FILE_LABEL[selected.fileType]} · {formatSize(selected.fileSizeBytes)}
                  </span>
                </div>
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-3">{selected.description}</p>
                {selected.highlights.length > 0 && (
                  <>
                    <h3 className="mt-6 text-sm font-semibold">What&apos;s inside</h3>
                    <ul className="mt-2 space-y-1.5">
                      {selected.highlights.map((h) => (
                        <li key={h} className="flex gap-2 text-sm text-ink-3">
                          <span aria-hidden="true" className="text-accent">
                            ✓
                          </span>
                          {h}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <div className="mt-6 border-t border-line pt-5">
                  {selected.canDownload ? (
                    <>
                      <Button onClick={() => download(selected)} disabled={downloading} fullWidth>
                        {downloading ? 'Preparing…' : `Download ${FILE_LABEL[selected.fileType]} file ↓`}
                      </Button>
                      <p className="mt-3 text-xs text-ink-3">
                        A starter template to adapt to your engagement. It is a drafting aid, not professional advice.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">Templates are a member benefit.</p>
                      <p className="mt-1 text-sm text-ink-3">
                        Become a GrowXQ member to download this and every other template.
                      </p>
                      <Button className="mt-4" href="/membership">
                        Explore membership
                      </Button>
                    </>
                  )}
                  <p role="status" className="mt-2 text-xs text-error">
                    {error}
                  </p>
                </div>
              </div>
            </div>
          )}
        </ResourceDialog>
      )}
    </div>
  );
}
