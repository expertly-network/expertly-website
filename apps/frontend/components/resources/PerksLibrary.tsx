'use client';
import { useState } from 'react';
import type { PerkDto, CollectionDto } from '@shared/resource';
import { PageContainer } from '@/components/layout/PageContainer';
import { Badge, Button, Card, Input, Select } from '@/components/ui';
import { ResourceHero } from './ResourceHero';
import { ResourceImage } from './ResourceImage';
import { ResourceDialog } from './ResourceDialog';
import { externalHref } from '@/lib/members/format';

export function PerksLibrary({
  perks,
  stacks,
  signedIn,
}: {
  perks: PerkDto[];
  stacks: CollectionDto[];
  signedIn: boolean;
}) {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('All tools');
  const [sort, setSort] = useState('recommended');
  const [selected, setSelected] = useState<PerkDto | null>(null);
  const [stack, setStack] = useState<CollectionDto | null>(null);
  const [compared, setCompared] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const categories = [
    'All tools',
    ...Array.from(new Set(perks.map((p) => p.category))),
  ];
  const filtered = perks
    .filter(
      (p) =>
        (category === 'All tools' || p.category === category) &&
        `${p.name} ${p.tagline} ${p.description} ${p.products.join(' ')}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'az'
        ? a.name.localeCompare(b.name)
        : Number(b.isFeatured) - Number(a.isFeatured) ||
          a.sortOrder - b.sortOrder,
    );
  const comparison = perks.filter((p) => compared.includes(p.id));
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice('Code copied.');
    } catch {
      setNotice('Couldn’t copy. Select the code and copy it manually.');
    }
  }
  const status = (p: PerkDto) =>
    p.canRedeem
      ? p.offer
      : p.lockReason === 'coming_soon'
        ? 'Offer coming soon'
        : p.lockReason === 'expired'
          ? 'Offer expired'
          : p.lockReason === 'sign_in'
            ? 'Sign in to see your offer'
            : 'No offer available for your tier';
  return (
    <div>
      <ResourceHero
        title="Member perks,"
        accent="negotiated for you."
        search={
          <Input
            id="perk-search"
            type="search"
            label=""
            aria-label="Find your next tool"
            className="bg-bg-card"
            placeholder="Search tools, products, GST, contracts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      >
        Discover the tax, legal, AI and productivity tools that make a better
        practice. Explore the products, compare your options, and find your next
        advantage.
      </ResourceHero>
      <PageContainer className="py-8 sm:py-10">
        {stacks.length > 0 && (
          <section aria-labelledby="stacks-heading" className="mb-9">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="mb-1 text-eyebrow text-accent">
                  A useful place to start
                </p>
                <h2 id="stacks-heading" className="text-heading">
                  Build your practice toolkit.
                </h2>
              </div>
              <p className="text-sm text-ink-3">
                Curated stacks. Tools that work together.
              </p>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-2 xl:grid-cols-5">
              {stacks.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setStack(s)}
                  className="group w-60 shrink-0 sm:w-auto min-w-0 rounded-card border border-line bg-bg-alt/50 p-5 text-left transition-colors hover:border-accent"
                >
                  <div className="mb-5 flex -space-x-2">
                    {s.items.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-2"
                      >
                        <ResourceImage
                          src={'logoUrl' in p ? p.logoUrl : null}
                          width={32}
                          height={32}
                          className="h-full w-full object-contain"
                        />
                      </span>
                    ))}
                  </div>
                  <span className="text-xs text-ink-3">
                    0{i + 1} / {s.items.length} tools
                  </span>
                  <h3 className="mt-1 text-sm font-semibold group-hover:text-accent">
                    {s.title} <span aria-hidden="true">↗</span>
                  </h3>
                </button>
              ))}
            </div>
          </section>
        )}
        <div className="mb-6 grid items-end gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
          <h2 className="text-heading">Explore the tools.</h2>
          <Select
            id="perk-sort"
            label="Sort by"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recommended">Recommended</option>
            <option value="az">A to Z</option>
          </Select>
        </div>
        <div
          role="group"
          aria-label="Perk categories"
          className="mb-7 flex gap-2 overflow-x-auto pb-2"
        >
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
          <h2 className="text-title">
            {category === 'All tools' ? 'All perks' : category}
          </h2>
          <span aria-live="polite" className="text-xs text-ink-3">
            {filtered.length} {filtered.length === 1 ? 'tool' : 'tools'}
          </span>
        </div>
        {!filtered.length ? (
          <Card padding="md">
            <p className="text-sm text-ink-3">No tools match your search.</p>
            <Button
              variant="ghost"
              onClick={() => {
                setQ('');
                setCategory('All tools');
              }}
            >
              Clear filters
            </Button>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <article
                key={p.id}
                className="flex min-w-0 flex-col overflow-hidden rounded-card border border-line bg-bg-card"
              >
                <button
                  onClick={() => {
                    setNotice('');
                    setSelected(p);
                  }}
                  className="group text-left"
                >
                  <div className="relative">
                    <ResourceImage
                      src={p.coverImageUrl}
                      className="aspect-[16/8] w-full object-cover"
                    />
                    <span className="absolute bottom-3 left-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-2">
                      <ResourceImage
                        src={p.logoUrl}
                        width={48}
                        height={48}
                        className="h-full w-full object-contain"
                      />
                    </span>
                    {p.isFeatured && (
                      <span className="absolute right-3 top-3">
                        <Badge variant="surface">GrowXQ pick</Badge>
                      </span>
                    )}
                  </div>
                  <div className="px-5 pb-3 pt-4">
                    <p className="text-xs text-ink-3">{p.category}</p>
                    <h3 className="mt-1 text-title group-hover:text-accent">
                      {p.name}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm text-ink-3">
                      {p.tagline}
                    </p>
                  </div>
                </button>
                <div className="mt-auto px-5 pb-4">
                  <p className="mb-4 border-t border-line pt-3 text-xs font-medium text-accent">
                    {status(p)}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="!px-0"
                      onClick={() => {
                        setNotice('');
                        setSelected(p);
                      }}
                    >
                      View details ↗
                    </Button>
                    {signedIn && (
                    <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-ink-3">
                      <input
                        type="checkbox"
                        checked={compared.includes(p.id)}
                        disabled={
                          compared.length >= 3 && !compared.includes(p.id)
                        }
                        onChange={(e) =>
                          setCompared((ids) =>
                            e.target.checked
                              ? [...ids, p.id]
                              : ids.filter((id) => id !== p.id),
                          )
                        }
                        className="h-4 w-4 accent-accent"
                        aria-label={`Compare ${p.name}`}
                      />
                      Compare
                    </label>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="mb-2 mt-8 rounded-card bg-bg-alt p-6 text-sm text-ink-3">
          <strong className="text-ink">More offers on the way.</strong> New
          offers appear here as soon as they go live.
        </div>
      </PageContainer>
      {compared.length > 0 && (
        <div className="sticky bottom-4 z-30 mx-auto mb-4 flex w-fit max-w-[calc(100%-2rem)] flex-wrap items-center justify-center gap-3 rounded-card border border-line bg-bg-card px-5 py-3 shadow-lg">
          <span className="text-sm">{compared.length} of 3 tools selected</span>
          <Button
            size="sm"
            onClick={() => setCompareOpen(true)}
            disabled={compared.length < 2}
          >
            Compare tools
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCompared([])}>
            Clear
          </Button>
        </div>
      )}
      {selected && (
        <ResourceDialog title={selected.name} onClose={() => setSelected(null)}>
          {!signedIn ? (
            // Guests can browse the cards, but product details, offers and links need a sign-in.
            <div className="flex flex-col items-center gap-4 px-2 py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-line bg-white p-2.5">
                <ResourceImage
                  src={selected.logoUrl}
                  width={64}
                  height={64}
                  className="h-full w-full object-contain"
                />
              </span>
              <h3 className="text-title">You need to sign in to view this.</h3>
              <p className="max-w-[420px] text-sm leading-relaxed text-ink-3">
                Sign in or create a free account to see {selected.name}&apos;s details, offers
                and website link.
              </p>
              <Button href="/login?returnTo=/perks">Sign in</Button>
            </div>
          ) : (
          <>
          <ResourceImage
            src={selected.coverImageUrl}
            className="mb-5 aspect-[16/6] w-full rounded-xl object-cover"
          />
          <Badge variant="brand">{selected.category}</Badge>
          <h3 className="my-3 text-title">{selected.tagline}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-3">
            {selected.description}
          </p>
          <div className="my-5 flex flex-wrap gap-2">
            {selected.products.map((p) => (
              <Badge key={p}>{p}</Badge>
            ))}
          </div>
          <Card padding="sm">
            <p className="text-sm font-semibold">{status(selected)}</p>
            {selected.canRedeem && (
              <>
                <p className="mt-3 whitespace-pre-line text-sm text-ink-3">
                  {selected.offerTerms}
                </p>
                {selected.couponCode && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <code className="select-all rounded-lg bg-bg-alt px-4 py-3 text-sm">
                      {selected.couponCode}
                    </code>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copy(selected.couponCode!)}
                    >
                      Copy code
                    </Button>
                  </div>
                )}
                {externalHref(selected.offerUrl) && (
                  <Button
                    className="mt-4"
                    href={externalHref(selected.offerUrl) ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Redeem offer ↗
                  </Button>
                )}
                {selected.offerExpiresAt && (
                  <p className="mt-3 text-xs text-ink-3">
                    Valid through {selected.offerExpiresAt}
                  </p>
                )}
              </>
            )}
            {selected.lockReason === 'sign_in' && (
              <Button className="mt-4" href="/login?returnTo=/perks">
                Sign in to see your offer
              </Button>
            )}
            {selected.lockReason === 'unavailable' && signedIn && (
              <Button className="mt-4" variant="secondary" href="/membership">
                Explore membership
              </Button>
            )}
            <p role="status" className="mt-2 text-xs text-ink-3">
              {notice}
            </p>
          </Card>
          <Button
            className="mt-5"
            variant="ghost"
            href={externalHref(selected.websiteUrl) ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit product website ↗
          </Button>
          </>
          )}
        </ResourceDialog>
      )}
      {stack && (
        <ResourceDialog title={stack.title} onClose={() => setStack(null)}>
          <p className="mb-5 text-sm text-ink-3">{stack.description}</p>
          <div className="space-y-3">
            {stack.items
              .filter((p): p is PerkDto => 'logoUrl' in p)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setStack(null);
                    setSelected(p);
                  }}
                  className="flex w-full items-center gap-4 rounded-xl border border-line p-4 text-left hover:bg-bg-alt"
                >
                  <ResourceImage
                    src={p.logoUrl}
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 object-contain"
                  />
                  <span>
                    <strong className="text-sm">{p.name}</strong>
                    <span className="mt-1 block text-xs text-ink-3">
                      {p.tagline}
                    </span>
                  </span>
                  <span className="ml-auto text-accent">↗</span>
                </button>
              ))}
            {!stack.items.length && (
              <p className="text-sm text-ink-3">
                This toolkit is being curated. Check back soon.
              </p>
            )}
          </div>
        </ResourceDialog>
      )}
      {compareOpen && (
        <ResourceDialog
          title="Compare your tools"
          onClose={() => setCompareOpen(false)}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr>
                  <th className="p-3">Tool</th>
                  {comparison.map((p) => (
                    <th key={p.id} className="p-3">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Category', 'Products', 'About', 'Your offer'].map(
                  (row, i) => (
                    <tr key={row} className="border-t border-line">
                      <th className="p-3 align-top text-xs text-ink-3">
                        {row}
                      </th>
                      {comparison.map((p) => (
                        <td
                          key={p.id}
                          className="p-3 align-top text-sm text-ink-3"
                        >
                          {
                            [
                              p.category,
                              p.products.join(', '),
                              p.description,
                              status(p),
                            ][i]
                          }
                        </td>
                      ))}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </ResourceDialog>
      )}
    </div>
  );
}
