'use client';
import { useState } from 'react';
import type { LearningDto, CollectionDto } from '@shared/resource';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge, Button, Card, Input, Select } from '@/components/ui';
import { ResourceHero } from './ResourceHero';
import { ResourceImage } from './ResourceImage';
import { ResourceDialog } from './ResourceDialog';

function embedUrl(video: LearningDto): string | null {
  if (!video.canWatch || !video.videoUrl || video.videoProvider !== 'youtube')
    return null;
  try {
    const url = new URL(video.videoUrl);
    const id =
      url.hostname === 'youtu.be'
        ? url.pathname.slice(1)
        : url.pathname === '/watch'
          ? url.searchParams.get('v')
          : url.pathname.split('/').pop();
    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? `https://www.youtube-nocookie.com/embed/${id}?rel=0`
      : null;
  } catch {
    return null;
  }
}
export function LearningsLibrary({
  videos,
  playlists,
}: {
  videos: LearningDto[];
  playlists: CollectionDto[];
}) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All topics');
  const [audience, setAudience] = useState('all');
  const [level, setLevel] = useState('all');
  const [length, setLength] = useState('all');
  const [current, setCurrent] = useState<LearningDto | null>(null);
  const [queue, setQueue] = useState<LearningDto[]>([]);
  const [pathName, setPathName] = useState('Video library');
  const featured =
    videos.find((v) => v.isFeatured && v.canWatch) ||
    videos.find((v) => v.isFeatured) ||
    videos[0];
  const filtered = videos.filter(
    (v) =>
      (category === 'All topics' || v.category === category) &&
      (audience === 'all' ||
        !v.audiences.length ||
        v.audiences.includes(audience as 'tax' | 'legal' | 'audit')) &&
      (level === 'all' || v.level === level) &&
      (length === 'all' ||
        (length === 'short'
          ? v.durationMinutes < 10
          : length === 'medium'
            ? v.durationMinutes >= 10 && v.durationMinutes <= 20
            : v.durationMinutes > 20)) &&
      `${v.title} ${v.summary} ${v.channel || ''}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  function play(
    v: LearningDto,
    list: LearningDto[] = filtered,
    name = 'Video library',
  ) {
    setQueue(list);
    setPathName(name);
    setCurrent(v);
  }
  const index = current ? queue.findIndex((v) => v.id === current.id) : -1;
  return (
    <div>
      <ResourceHero
        title="The technology your profession"
        accent="never taught you."
        search={
          <Input
            id="learning-search"
            label=""
            aria-label="Search videos"
            className="bg-bg-card"
            type="search"
            placeholder="AI, drafting, Excel, privacy…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      >
        Hand-picked videos on AI, automation and data, chosen for tax, legal and
        audit practitioners. Less searching. More putting what you learn into
        practice.
      </ResourceHero>
      <PageContainer className="py-8 sm:py-10">
        {featured && (
          <section
            aria-label="Start here"
            className="mb-10 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
          >
            <button
              onClick={() => play(featured, videos)}
              className="group relative min-h-72 overflow-hidden rounded-card bg-ink text-left"
            >
              <ResourceImage
                src={featured.thumbnailUrl}
                className="absolute inset-0 h-full w-full object-cover opacity-40 transition-opacity group-hover:opacity-50"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/50 to-transparent" />
              <div className="relative p-6 sm:p-8">
                <Badge variant="surface">Start here · GrowXQ pick</Badge>
                <h2 className="mb-3 mt-8 max-w-xl text-heading text-white">
                  {featured.title}
                </h2>
                <p className="max-w-xl text-sm text-white/75">
                  {featured.summary}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/75">
                  <span className="rounded-full bg-white px-4 py-3 text-sm font-medium text-ink">
                    {featured.canWatch ? '▶ Watch now' : 'Explore video →'}
                  </span>
                  <span>{featured.durationMinutes} min</span>
                  <span className="capitalize">{featured.level}</span>
                  <span>{featured.channel}</span>
                </div>
              </div>
            </button>
            <Card padding="md" className="flex flex-col justify-between">
              <div>
                <p className="text-eyebrow text-accent">
                  A little learning, often.
                </p>
                <h2 className="mb-3 mt-3 text-heading">
                  Make room for your next skill.
                </h2>
                <p className="text-sm text-ink-3">
                  Follow a learning path or pick a short video. Every session is
                  chosen with your day-to-day practice in mind.
                </p>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-line pt-5">
                <div>
                  <p className="text-2xl font-medium">{videos.length}</p>
                  <p className="text-xs text-ink-3">curated videos</p>
                </div>
                <div>
                  <p className="text-2xl font-medium">{playlists.length}</p>
                  <p className="text-xs text-ink-3">learning paths</p>
                </div>
              </div>
              <p className="mt-5 text-xs text-ink-3">
                Signed-in clients can try the first video in each path.
                Membership unlocks the full library.
              </p>
            </Card>
          </section>
        )}
        {playlists.length > 0 && (
          <section aria-labelledby="paths-heading" className="mb-9">
            <h2 id="paths-heading" className="text-heading">
              Learning paths
            </h2>
            <p className="mb-5 mt-2 text-sm text-ink-3">
              Short playlists in a sensible order. Build a skill, one useful
              session at a time.
            </p>
            <div className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 xl:grid-cols-5">
              {playlists.map((p) => {
                const items = p.items.filter(
                  (v): v is LearningDto => 'canWatch' in v,
                );
                return (
                  <button
                    key={p.id}
                    disabled={!items.length}
                    onClick={() => play(items[0], items, p.title)}
                    className="group flex w-60 shrink-0 sm:w-auto min-w-0 flex-col rounded-card border border-line p-4 text-left transition-colors hover:border-accent disabled:opacity-50"
                  >
                    <div className="relative mb-4 h-20 w-full">
                      {items
                        .slice(0, 3)
                        .reverse()
                        .map((v, i) => (
                          <div
                            key={v.id}
                            className={`absolute top-0 h-20 w-3/4 overflow-hidden rounded-lg border-2 border-bg ${i === 0 ? 'right-0 rotate-6' : i === 1 ? 'left-3 rotate-3' : 'left-0'}`}
                          >
                            <ResourceImage
                              src={v.thumbnailUrl}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                    </div>
                    <h3 className="text-sm font-semibold group-hover:text-accent">
                      {p.title}
                    </h3>
                    <p className="mb-4 mt-2 line-clamp-2 text-xs text-ink-3">
                      {p.description}
                    </p>
                    <p className="mt-auto flex w-full justify-between gap-2 border-t border-line pt-3 text-xs text-ink-3">
                      <span>
                        {items.length} videos ·{' '}
                        {items.reduce((n, v) => n + v.durationMinutes, 0)} min
                      </span>
                      <span className="text-accent">Start →</span>
                    </p>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <div className="mb-5 grid items-end gap-4 sm:grid-cols-3">
          <Select
            id="learning-audience"
            label="Your profession"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="all">All professions</option>
            <option value="tax">Tax & accounting</option>
            <option value="legal">Law</option>
            <option value="audit">Audit</option>
          </Select>
          <Select
            id="learning-level"
            label="Level"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="all">All levels</option>
            {['beginner', 'intermediate', 'advanced'].map((l) => (
              <option key={l} value={l}>
                {l[0].toUpperCase() + l.slice(1)}
              </option>
            ))}
          </Select>
          <Select
            id="learning-length"
            label="Length"
            value={length}
            onChange={(e) => setLength(e.target.value)}
          >
            <option value="all">Any length</option>
            <option value="short">Under 10 minutes</option>
            <option value="medium">10–20 minutes</option>
            <option value="long">Over 20 minutes</option>
          </Select>
        </div>
        <div
          role="group"
          aria-label="Learning topics"
          className="mb-6 flex gap-2 overflow-x-auto pb-2"
        >
          {[
            'All topics',
            ...Array.from(new Set(videos.map((v) => v.category))),
          ].map((c) => (
            <button
              key={c}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-xs font-medium ${category === c ? 'bg-ink text-white' : 'bg-bg-alt text-ink-3 hover:text-ink'}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-title">
            {category === 'All topics' ? 'All videos' : category}
          </h2>
          <p aria-live="polite" className="text-xs text-ink-3">
            {filtered.length} {filtered.length === 1 ? 'video' : 'videos'}
          </p>
        </div>
        {!filtered.length ? (
          <Card padding="md">
            <p className="text-sm text-ink-3">No videos match these filters.</p>
            <Button
              variant="ghost"
              onClick={() => {
                setQ('');
                setCategory('All topics');
                setAudience('all');
                setLevel('all');
                setLength('all');
              }}
            >
              Clear filters
            </Button>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((v) => (
              <button
                key={v.id}
                onClick={() => play(v)}
                className="group flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-bg-card text-left transition-colors hover:border-accent"
              >
                <div className="relative w-full">
                  <ResourceImage
                    src={v.thumbnailUrl}
                    className="aspect-video w-full object-cover"
                  />
                  <span className="absolute bottom-3 right-3 rounded-lg bg-ink/90 px-2 py-1 text-xs text-white">
                    {v.durationMinutes} min
                  </span>
                  <span
                    aria-hidden="true"
                    className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-ink"
                  >
                    {v.canWatch ? '▶' : '⌑'}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="mb-2 text-xs text-accent">
                    {v.category} <span className="text-ink-3">· {v.level}</span>
                  </p>
                  <h3 className="text-title group-hover:text-accent">
                    {v.title}
                  </h3>
                  <p className="mb-4 mt-2 line-clamp-2 text-sm text-ink-3">
                    {v.summary}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-3">
                    <span>{v.channel}</span>
                    <span className="font-medium text-accent">
                      {v.canWatch
                        ? 'Watch now ↗'
                        : v.lockReason === 'sign_in'
                          ? 'Sign in to watch'
                          : 'Members only'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="my-8 rounded-card bg-bg-alt p-6">
          <Badge variant="brand">GrowXQ Originals · Coming soon</Badge>
          <h2 className="mb-2 mt-4 text-heading">Soon, our own sessions.</h2>
          <p className="max-w-2xl text-sm text-ink-3">
            Practitioner-led sessions will join the curated library as they
            become available. For now, find your next useful idea in the videos
            above.
          </p>
        </div>
        <p className="text-xs text-ink-3">
          Curated videos belong to their creators. YouTube videos play through
          YouTube’s privacy-enhanced player.
        </p>
      </PageContainer>
      {current && (
        <ResourceDialog title={current.title} onClose={() => setCurrent(null)}>
          <p className="mb-3 text-xs text-accent">
            {pathName}
            {index >= 0 ? ` · ${index + 1} of ${queue.length}` : ''}
          </p>
          {current.canWatch && current.videoUrl ? (
            <>
              {current.videoProvider === 'youtube' && embedUrl(current) ? (
                <iframe
                  key={current.id}
                  src={embedUrl(current)!}
                  title={current.title}
                  className="aspect-video w-full rounded-xl bg-ink"
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : current.videoProvider === 'file' ? (
                <video
                  key={current.id}
                  src={current.videoUrl}
                  poster={current.thumbnailUrl || undefined}
                  controls
                  playsInline
                  className="aspect-video w-full rounded-xl bg-ink"
                >
                  <track kind="captions" />
                </video>
              ) : (
                <p className="text-sm text-ink-3">
                  This video cannot be embedded.
                </p>
              )}
              <p className="mt-3 text-xs text-ink-3">
                If the player is unavailable,{' '}
                <a
                  className="text-accent underline"
                  href={current.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  open the original video ↗
                </a>
                .
              </p>
            </>
          ) : (
            <Card padding="md">
              <Badge variant="brand">
                {current.lockReason === 'sign_in'
                  ? 'Your next skill starts here'
                  : 'Continue with membership'}
              </Badge>
              <h3 className="mb-2 mt-4 text-title">
                {current.lockReason === 'sign_in'
                  ? 'Sign in to start watching.'
                  : 'This session is for members.'}
              </h3>
              <p className="mb-5 text-sm text-ink-3">
                {current.lockReason === 'sign_in'
                  ? 'Create your free account or sign in to try the first video in every learning path.'
                  : 'Members can watch every video. You can also explore the opening session in each learning path.'}
              </p>
              <Button
                href={
                  current.lockReason === 'sign_in'
                    ? '/login?returnTo=/learnings'
                    : '/membership'
                }
              >
                {current.lockReason === 'sign_in'
                  ? 'Sign in'
                  : 'Explore membership'}
              </Button>
            </Card>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Badge>{current.category}</Badge>
            <Badge>{current.level}</Badge>
            <Badge>{current.durationMinutes} min</Badge>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-3">
            {current.summary}
          </p>
          <p className="mt-2 text-xs text-ink-3">
            By {current.channel || 'the video creator'}
          </p>
          {queue.length > 1 && (
            <>
              <div className="my-5 flex justify-between gap-3">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={index <= 0}
                  onClick={() => setCurrent(queue[index - 1])}
                >
                  ← Previous
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={index < 0 || index >= queue.length - 1}
                  onClick={() => setCurrent(queue[index + 1])}
                >
                  Next video →
                </Button>
              </div>
              <h3 className="mb-3 text-sm font-semibold">
                In this{' '}
                {pathName === 'Video library' ? 'selection' : 'learning path'}
              </h3>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {queue.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => setCurrent(v)}
                    aria-current={v.id === current.id ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-sm ${v.id === current.id ? 'bg-bg-alt text-accent' : 'hover:bg-bg-alt text-ink'}`}
                  >
                    <span className="text-xs text-ink-3">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="flex-1">{v.title}</span>
                    <span className="text-xs text-ink-3">
                      {v.canWatch ? `${v.durationMinutes} min` : 'Locked'}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </ResourceDialog>
      )}
    </div>
  );
}
