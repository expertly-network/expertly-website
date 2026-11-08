# GrowXQ frontend (`apps/frontend/`)

Next.js App Router + TypeScript + Tailwind. This file covers conventions specific to working in
this app. Architecture-level rules (the backend/frontend session split, the API-as-fixed-contract
rule, when a schema change is needed) live in the **root `CLAUDE.md`** — read that first if you
haven't. This file assumes it and only adds what's specific to building pages here.

## Before writing any markup

1. **Check `docs/design-system.md`.** Every color, font size, and radius is a token — never
   hardcode a hex value, an arbitrary `text-[Npx]`, or a one-off `rounded-[10px]`. If a value you
   need isn't a token yet, that doc says what to do about it.
2. **Check `components/ui/`.** Button, Input, Select, Textarea, Card, Badge already exist and are
   documented in `docs/design-system.md`'s Components section. If you're about to write a
   `<button className="...">` or a bordered `<div>` by hand, stop and check whether `Button`/`Card`
   already covers it — that's exactly the kind of per-page drift this folder exists to prevent.
3. **Check `design/static_html/<page>.html`** for the page you're building — pixel-level layout,
   copy, and interaction reference, per the root CLAUDE.md's methodology. Don't design from
   scratch when a prototype page already exists.

If you add a genuinely new, recurring visual pattern (not covered by an existing token or
component), add it to `docs/design-system.md` / `components/ui/` in the same change — don't leave
it as an inline one-off for the next page to copy.

## Mobile-first rules — every page, every change

Phones are a first-class layout, not a squeezed desktop. These apply to every new page, every
redesign and every fix; a page isn't done until they hold. The shared pieces they refer to are
catalogued in `docs/design-system.md` → "Phone-width patterns".

**Reuse before writing.** Check the catalogue first: `SwipeRow`, `MobileFilterBar` + `FilterSheet`
(+ `useLiveCount`), `BottomSheet`, `STICKY_UNDER_MOBILE_BAR` (`lib/ui/mobile.ts`), `usePhoneText`,
`CompactRow`, `ArticleListRow`, `MobileViewAll`. A pattern needed on a second page is extracted into
`components/ui/` (markup) or `lib/hooks/` / `lib/ui/` (logic, constants) in that same change and
added to the catalogue. Never copy-paste a pattern into a second page.

**Layout and content on phones (below `sm`, 640px):**
- One primary action per screen, never repeated. If a sticky CTA bar carries it (e.g. the profile's
  Request Consultation), hide the duplicates below the bar's breakpoint.
- Lists: compact rows or a swipe row instead of tall cards. Key facts (price, date, name) never
  truncate. List cards are for comparing; actions live on the detail page.
- More than two filters: one sticky "Filters" button opening a `FilterSheet`, with removable chips
  and a live result count. Desktop keeps `FilterPopover` dropdowns.
- Long lists load more in growing batches (e.g. 10 → 35 → 85 → …), not dozens of small clicks.
- No card inside a card: drop the outer frame on phones and let the inner cards use the width.
- Hide secondary copy (`hidden sm:block`) rather than ellipsis-cutting it. Phone-only wording is
  swapped in CSS (`sm:hidden` / `hidden sm:inline`) so there's no hydration flash; attributes
  (placeholders) use `usePhoneText`.
- Tap targets ≥ 44px; inputs ≥ 16px text (stops iOS zoom); 20px side gutter (`PageContainer`);
  centred display text gets a `max-w-[…]` so it never runs edge to edge.
- Anything sticky under the mobile top bar uses `STICKY_UNDER_MOBILE_BAR`, never a raw `top-[61px]`.
- No visible scrollbars anywhere (pages, side panels, sheets, lists, swipe rows): one global rule
  in `app/globals.css` hides them site-wide. Areas still scroll — never add per-element scrollbar
  classes, and never rely on a visible bar as the only scroll cue (let content peek or fade).

**Implementation:**
- Tailwind mobile-first: unprefixed classes are the phone layout, `sm:` / `lg:` the larger ones.
  When fixing phones on an existing page, isolate the change behind `max-sm:` / `sm:` resets so the
  desktop render is unchanged — and confirm it by measuring, not by eye.
- When the structure genuinely differs per breakpoint (e.g. `MemberCard`, `EventRow`), render a
  phone block (`sm:hidden`) and a desktop block (`hidden sm:…`) instead of fighting one grid with
  dozens of overrides. Lazy images in the hidden block don't load.
- Never put a literal class name together at runtime (`auto-cols-[${w}]`): map props to complete
  literal strings (see `SwipeRow`), or Tailwind won't generate them.
- `@shared/*` is `import type` only on the frontend — a runtime import pulls NestJS/Swagger into the
  bundle and takes the whole dev server down.

**Before calling it done:** check 320, 375, ~490 (a large phone) and 1440px, plus 768 if the page has
a tablet layout. No horizontal scroll (`scrollWidth === clientWidth`). Exercise the interactions
(sheets, swipe rows, load more, sticky bars) in a real browser — headless Chrome for public pages,
the signed-in Chrome session (Claude in Chrome) for gated content — and say plainly if you couldn't.

## Contract, not guesswork

Import request/response shapes from `@shared/*` (`packages/shared-types/`) with `import type` —
never redefine a copy of a DTO locally. If a page needs data the current API doesn't provide, that
is a contract gap to flag back (see root CLAUDE.md), not something to patch around client-side
(e.g. fetching extra fields from Supabase directly to fill the gap).

## Member profile ↔ profile PDF — always change both

The downloadable profile PDF (`components/members/pdf/MemberProfilePdf.tsx`, react-pdf) is a
second renderer of the member profile page (`app/(shell)/members/[slug]/`, `components/members/`).
**Any change to what the profile shows or how — a section added/removed/reordered, a field, how
work history is grouped or dated, how text is formatted, labels/headings — must be made in the PDF
in the same change.** Shared logic lives in one place so the two can't drift: work-history
grouping/periods in `lib/members/work-history.ts`, paragraph/bullet parsing in
`lib/text/text-blocks.ts`, value formatting in `lib/members/format.ts`, logo assets in
`lib/brand.ts`. Put new display logic in `lib/` and call it from both, rather than writing it
inside one renderer. Data the page fetches separately (member recommendations, via
`/members/:id/recommendations`) is fetched by `downloadMemberProfilePdf.tsx` too — a new
separately-loaded section needs the same.

The article page has a second PDF (`components/articles/pdf/ArticlePdf.tsx`, body parsed by
`lib/articles/html-blocks.ts`). Both PDFs share `lib/pdf/theme.ts` (palette, font names) and
`lib/pdf/browser.ts` (font registration, image re-encoding, logo, saving) — brand changes go there
once. react-pdf 4.9 gotcha: never put `lineHeight` on the `<Page>` style — inherited into the fixed
footer, it silently drops the whole footer (page numbers included). Set it on the body `View`
together with the page's `fontSize`.

## Auth

Route/role gating happens in `middleware.ts` and `lib/auth/session-claims.ts` (JWT verified
locally, no network round-trip for the common case) — see `docs/auth.md` for the full flow before
touching anything auth-related. `supabase-js` is called directly from the frontend for
auth/session operations only; all other data goes through the NestJS API.

## Verifying a page

Type-check (`pnpm typecheck` or, if the workspace package manager is unavailable in your
environment, `./node_modules/.bin/tsc --noEmit` directly from this directory) is necessary but not
sufficient. Before calling a page done: run the dev server and actually look at it in a browser —
golden path and the obvious edge cases (empty state, error state, the unauthenticated/
wrong-role redirect). If you can't drive a browser in your environment, say so explicitly rather
than reporting the page as verified.
