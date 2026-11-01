'use client';

import { useEffect } from 'react';
import type { PerkDto } from '@shared/resource';
import { Button, SideDrawer } from '@/components/ui';
import { ResourceImage } from './ResourceImage';
import { displayHost, externalHref } from '@/lib/members/format';

const CHECK = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    aria-hidden="true"
  >
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Arrow({ d }: { d: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
    >
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <div className="text-mono-label text-ink-4">{children}</div>;
}

// Perk details in a right-side drawer (the perks reference design): cover with prev/next and close,
// overlapping logo, name and tagline, the member-offer "ticket", about, products, how to claim,
// more in the same category, and a pinned footer CTA. Guests see a sign-in prompt instead of the
// offer and links. ← / → step through the current (filtered) list.
export function PerkDrawer({
  perk,
  list,
  signedIn,
  status,
  notice,
  onCopy,
  onSelect,
  onClose,
}: {
  perk: PerkDto;
  /** The perks the drawer can step through, in display order. */
  list: PerkDto[];
  signedIn: boolean;
  /** One-line offer status for a perk ("20% off", "Offer coming soon", …). */
  status: (p: PerkDto) => string | null;
  notice: string;
  onCopy: (code: string) => void;
  onSelect: (p: PerkDto) => void;
  onClose: () => void;
}) {
  const index = list.findIndex((p) => p.id === perk.id);
  const related = list.filter((p) => p.category === perk.category && p.id !== perk.id).slice(0, 3);
  const step = (delta: number) => {
    if (list.length < 2 || index === -1) return;
    onSelect(list[(index + delta + list.length) % list.length]);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        step(e.key === 'ArrowRight' ? 1 : -1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const website = externalHref(perk.websiteUrl);
  const offerHref = perk.canRedeem ? externalHref(perk.offerUrl) : null;
  const primaryHref = offerHref ?? website;

  const footer = signedIn ? (
    primaryHref ? (
      <Button href={primaryHref} target="_blank" rel="noopener noreferrer" fullWidth>
        {offerHref ? 'Redeem offer ↗' : `Visit ${perk.name} ↗`}
      </Button>
    ) : null
  ) : (
    <Button href="/login?returnTo=/perks" fullWidth>
      Sign in to see details
    </Button>
  );

  return (
    <SideDrawer label={`${perk.name} — perk details`} onClose={onClose} footer={footer}>
      <div className="relative">
        <ResourceImage src={perk.coverImageUrl} className="h-[200px] w-full object-cover sm:h-[220px]" />
        <div className="absolute inset-x-3.5 top-3.5 flex items-center gap-2">
          {list.length > 1 && index !== -1 && (
            <div
              role="group"
              aria-label="Browse perks"
              className="flex items-center gap-0.5 rounded-full bg-white/90 p-[3px] shadow-[0_4px_16px_-6px_rgba(0,0,0,0.3)] backdrop-blur"
            >
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous perk"
                className="grid h-[30px] w-[30px] place-items-center rounded-full text-ink-2 hover:bg-bg-alt"
              >
                <Arrow d="M15 18l-6-6 6-6" />
              </button>
              <span className="min-w-11 px-1.5 text-center text-[11.5px] text-ink-3">
                {index + 1} / {list.length}
              </span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next perk"
                className="grid h-[30px] w-[30px] place-items-center rounded-full text-ink-2 hover:bg-bg-alt"
              >
                <Arrow d="M9 18l6-6-6-6" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            autoFocus
            className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink shadow-[0_4px_16px_-6px_rgba(0,0,0,0.3)] backdrop-blur transition-transform hover:scale-105"
          >
            <Arrow d="M18 6L6 18M6 6l12 12" />
          </button>
        </div>
      </div>

      <div className="relative z-[2] -mt-8 px-5 sm:px-7">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[18px] border-[3px] border-bg-card bg-white p-2 shadow-[0_10px_26px_-10px_rgba(0,0,0,0.35)]">
          <ResourceImage src={perk.logoUrl} width={64} height={64} className="h-full w-full object-contain" />
        </span>
        <h2 className="mt-3.5 text-[26px] font-semibold leading-[1.15] tracking-[-0.03em] text-ink">{perk.name}</h2>
        {perk.tagline && <p className="mt-1.5 text-[15px] leading-normal text-ink-3">{perk.tagline}</p>}
        <div className="mt-3.5 flex flex-wrap gap-2">
          <span className="rounded-full border border-line-2 px-3 py-1 text-[12.5px] text-ink-2">{perk.category}</span>
          {signedIn && website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full border border-line-2 px-3 py-1 text-[12.5px] text-ink-2 hover:border-ink-3 hover:text-ink"
            >
              {displayHost(perk.websiteUrl)} ↗
            </a>
          )}
          {perk.isFeatured && (
            <span className="rounded-full border border-line-2 px-3 py-1 text-[12.5px] text-ink-2">GrowXQ pick</span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-7 px-5 pb-7 pt-6 sm:px-7">
        {!signedIn ? (
          <div className="rounded-2xl border border-dashed border-line-2 bg-bg-alt p-5 text-center">
            <p className="text-sm font-semibold text-ink">Sign in to view this perk</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-3">
              Create a free account or sign in to see {perk.name}&apos;s details, offers and website link.
            </p>
          </div>
        ) : (
          <>
            {/* The offer "ticket". */}
            <div className="flex items-start gap-4 rounded-2xl border border-dashed border-[color-mix(in_oklab,var(--accent)_45%,var(--line))] bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_10%,var(--bg-card)),color-mix(in_oklab,var(--accent)_4%,var(--bg-card)))] p-5">
              <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-xl bg-accent text-white">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L2 12V2h10l8.6 8.6a2 2 0 010 2.8z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="7" cy="7" r="1.5" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <small className="text-[11px] font-semibold text-accent">Member offer</small>
                <h3 className="mb-1 mt-0.5 text-[19px] font-semibold tracking-[-0.02em] text-ink">
                  {status(perk) ?? 'Member pricing'}
                </h3>
                {perk.canRedeem && perk.offerTerms && (
                  <p className="whitespace-pre-line text-[13px] leading-[1.55] text-ink-3">{perk.offerTerms}</p>
                )}
                {perk.canRedeem && perk.couponCode && (
                  <div className="mt-3 flex flex-wrap items-center gap-2.5">
                    <code className="select-all rounded-lg border border-line bg-bg-card px-3.5 py-2 text-sm">
                      {perk.couponCode}
                    </code>
                    <Button size="sm" variant="secondary" onClick={() => onCopy(perk.couponCode!)}>
                      Copy code
                    </Button>
                  </div>
                )}
                {perk.canRedeem && perk.offerExpiresAt && (
                  <p className="mt-2 text-xs text-ink-3">Valid through {perk.offerExpiresAt}</p>
                )}
                {perk.lockReason === 'unavailable' && (
                  <Button className="mt-3" size="sm" variant="secondary" href="/membership">
                    Explore membership
                  </Button>
                )}
                <p role="status" className="mt-1 text-xs text-ink-3">
                  {notice}
                </p>
              </div>
            </div>

            {perk.description && (
              <section className="flex flex-col gap-3">
                <SectionLabel>About</SectionLabel>
                <p className="whitespace-pre-line text-[14.5px] leading-[1.7] text-ink-2">{perk.description}</p>
              </section>
            )}

            {perk.products.length > 0 && (
              <section className="flex flex-col gap-3">
                <SectionLabel>Products covered</SectionLabel>
                <div className="grid gap-2 sm:grid-cols-2">
                  {perk.products.map((product) => (
                    <div
                      key={product}
                      className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5 text-[13.5px] font-medium text-ink"
                    >
                      <span className="flex-none text-accent">{CHECK}</span>
                      {product}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="flex flex-col gap-3">
              <SectionLabel>How to claim</SectionLabel>
              <ol className="grid gap-2.5 sm:grid-cols-3">
                {[
                  ['Open the offer', 'Review the member terms.'],
                  ['Sign up', 'Use your GrowXQ email.'],
                  ['Offer applies', 'Use the code at checkout if there is one.'],
                ].map(([title, body], i) => (
                  <li
                    key={title}
                    className="rounded-[14px] border border-line bg-bg-alt p-3.5 text-[13px] leading-snug"
                  >
                    <span className="mb-2.5 grid h-6 w-6 place-items-center rounded-full border border-line-2 bg-bg-card text-[11.5px] font-semibold">
                      {i + 1}
                    </span>
                    <b className="mb-0.5 block font-semibold text-ink">{title}</b>
                    <span className="text-xs text-ink-3">{body}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        {related.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionLabel>{`More in ${perk.category}`}</SectionLabel>
            <div className="grid grid-cols-3 gap-2.5 max-[420px]:grid-cols-1">
              {related.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelect(r)}
                  className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-bg-card text-left transition hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_10px_24px_-12px_rgba(0,0,0,0.2)]"
                >
                  <ResourceImage src={r.coverImageUrl} className="h-[74px] w-full border-b border-line object-cover" />
                  <b className="px-3 pb-0.5 pt-2.5 text-[13px] font-semibold text-ink">{r.name}</b>
                  <i className="line-clamp-2 px-3 pb-3 text-[11.5px] not-italic leading-snug text-ink-4">{r.tagline}</i>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </SideDrawer>
  );
}
