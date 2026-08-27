# Expertly — Design System Reference

Where every visual constant (color, font, type size, radius) is defined, and how to change one
without hunting through components. Source: the design repo's `static_html/assets/theme.css`,
literally titled "Expertly Design System" — the closest thing to an authoritative spec.

**The rule:** never hardcode a color hex, font size, or one-off radius directly in a component.
Use the token. If a value you need isn't a token yet, add it here first (or ask whether it should
be), then use it — don't reach for an arbitrary `text-[17px]` or `#00A582` inline.

## Where things live

| What | Source of truth | Consumed via |
|---|---|---|
| Colors | CSS custom properties in `apps/frontend/app/globals.css` | Tailwind utilities (`bg-accent`, `text-ink-3`, …) via `tailwind.config.ts` |
| Fonts | `apps/frontend/app/layout.tsx` (loads Geist + Archivo, exposes as CSS vars) | `font-sans` (Geist, default body) / `font-mono` (Archivo, labels) |
| Type scale (size/line-height/letter-spacing/weight) | `apps/frontend/tailwind.config.ts` → `theme.extend.fontSize` | `text-heading`, `text-eyebrow`, etc. — see table below |
| Radii | `apps/frontend/tailwind.config.ts` → `theme.extend.borderRadius` | `rounded-input` (10px), `rounded-card` (20px); everything else uses Tailwind's defaults (see below) |

Colors are CSS variables (not hardcoded into `tailwind.config.ts`) specifically so re-syncing
against the design repo, or swapping a value at runtime, is a one-line diff in `globals.css`.
Typography is a Tailwind `fontSize` scale (not CSS classes like the original `.eyebrow`/`.display`)
because this is a Tailwind-utility-first codebase — that's "standard practice" for this stack.

## Fonts

- **Geist** — body/UI text, the default (`font-sans`). Loaded via the `geist` npm package
  (`geist/font/sans`), not Google Fonts — Geist isn't on Google Fonts' catalog.
- **Archivo** — small-caps-style labels, eyebrows, mono-ish captions (`font-mono`). Loaded via
  `next/font/google`.
- Base body: 16px / line-height 1.5 / letter-spacing -0.005em (set once on `body` in
  `globals.css`; don't override per-component unless intentionally using a different scale token).

## Colors

| Token | Hex (default palette) | Use for |
|---|---|---|
| `bg` | `#FFFFFF` | Page background |
| `bg-alt` | `#F2FBF7` | Subtle tinted section/hover background (pale mint) |
| `bg-card` | `#FFFFFF` | Card/surface background — same as `bg` today but semantically distinct; keep using it on cards even though the value matches, in case it diverges later |
| `ink` | `#0B0B0C` | Primary text; **primary button background** (not `accent`) |
| `ink-2` | `#1E1E20` | Secondary-emphasis text, hover states on dark buttons |
| `ink-3` | `#5C5C61` | Muted text — subtitles, captions, labels, placeholders |
| `ink-4` | `#9A9AA0` | Decorative-only — icon fills, disabled-state text, index numbers. **2.80:1 on `bg`, fails WCAG AA for text (needs 4.5:1) — never use for real body/caption/meta content a user is meant to read.** Use `ink-3` (6.65:1, passes) for anything with actual information in it, even a caption. |
| `line` | `#ECECEE` | Default border/divider |
| `line-2` | `#DBDBDE` | Stronger border — outline buttons, icon containers |
| `accent` | `#00A582` | Interactive/brand accent — links, focus rings, "Forgot?", badges. **Not** the primary button color |
| `accent-2` | `#00C99E` | Lighter accent — logo dot, secondary highlights |
| `neon` | `#8BFCD8` | Decorative only (gradient fills, avatar-fallback backgrounds) — never for text/borders |
| `ok` | `#0E9E6E` | Success / verified state |
| `error` | `#DC2626` | Error / destructive state — form validation messages, delete confirmations, required-field indicators, admin reject actions. 4.83:1 on `bg`, passes AA. This was missing until now; the design repo's prototype hardcoded two different reds (`#e53935` and `#dc2626`) for the same meaning across different pages — `#dc2626` is the one carried forward since it's the one that actually passes contrast. |
| `nav-green` | `#0B3A2D` | The **footer**'s background (`theme.css`'s `.footer--minimal { background: var(--nav-green) }`) — confirmed directly, this one's genuinely correct. It is *not* the sidebar's color though: `design/static_html`'s `.d1-sidebar` (used app-wide) is `bg-ink`, a distinct near-black — an earlier pass here wrongly generalized "nav-green isn't used anywhere real" from that sidebar finding to the footer too. See `Sidebar`/`Footer` below. |

The design repo has two more full palettes (`navy`/`sage`, a `data-theme` switcher in the
prototype) — **not ported**, out of scope. If theming becomes a real requirement, they're a
values-only addition to the same CSS-variable pattern.

### Color combination rules

- Body text on any light surface (`bg`/`bg-card`/`bg-alt`): `ink` family only. Never `accent` for
  paragraph text — it reads as a link/CTA, not prose.
- **Primary button**: `bg-ink` + `text-bg` (white text on near-black) — not `accent`.
- **Secondary/outline button**: `border-line-2` + `text-ink` + `bg-bg-card`, hover `border-ink`.
- **Ghost button**: transparent + `text-ink-2`, hover `bg-bg-alt`.
- **Links / small CTAs inside content** (e.g. "Forgot password?"): `text-accent`.
- **Neutral badge/chip**: `bg-bg-alt` + `text-ink-2`.
- **High-emphasis chip**: `bg-ink` + `text-bg`.
- **Brand-tinted chip/badge**: accent-tinted background (`color-mix(in oklab, var(--accent) 10%, transparent)`, already used in `MemberBenefitsPanel`'s badge) + `text-accent`.
- **Dark surfaces** (`AuthRightPanel`, nav/footer `nav-green` chrome): white / `white/NN` opacity
  variants only — never the `ink` family, it has no contrast there.
- **Success/verified indicator**: `text-ok`.
- **Error/destructive indicator**: `text-error` — validation messages, required-field markers, destructive-action confirmations. Never a raw hex.
- **Pending/in-review indicator** (e.g. a member profile section awaiting admin verification): Tailwind's default `amber-50`/`amber-700` pair, used directly (not a `--`-prefixed token) — first and, as of this addition, only call site (`components/members/SectionBadge.tsx`). Promote to a real CSS-variable token if a second call site ever needs it.

## Typography scale

All defined in `tailwind.config.ts`'s `fontSize` — use the class name, get size + line-height +
letter-spacing + weight together.

| Class | Size | Line-height | Tracking | Weight | Use | Origin |
|---|---|---|---|---|---|---|
| `text-eyebrow` | 11px | normal | 0.14em | 500 | Small-caps label above a heading | theme.css `.eyebrow` |
| `text-display` | 44–96px (clamp) | 0.98 | -0.03em | 500 | Hero/marketing display text | theme.css `.display` |
| `text-headline` | 32–56px (clamp) | 1.04 | -0.025em | 500 | Major section headline | theme.css `.headline` |
| `text-section-title` | 28–44px (clamp) | 1.08 | -0.02em | 500 | Section heading | theme.css `.section-title` |
| `text-lede` | 17–20px (clamp) | 1.5 | -0.005em | 400 | **The standard body-paragraph size, used app-wide** for any section/page-intro paragraph that sits directly under a heading and explains what that section is about (pair with `text-ink-3`) — home page section paragraphs, every page hero's subhead, auth card subheads, application-wizard step descriptions. NOT for card/list-item-level text (a member bio excerpt, an FAQ answer, article body prose, sidebar meta) — those stay at `text-sm`/`text-caption`, matching the design's own smaller sizing there. | theme.css `.lede` |
| `text-heading` | 32px | 1.1 | -0.02em | 500 | Page/card heading (e.g. `/login`'s "Get started with Expertly.") | This app — consolidated from `auth-title` and similar 28–32px headings |
| `text-article-title` | 24–38px (clamp) | 1.12 | -0.025em | 500 | Article detail page `<h1>` only — deliberately its own, smaller-topped clamp than `text-headline`, matching `.art-detail-title` | theme.css `.art-detail-title` |
| `text-title` | 18px | 1.25 | -0.012em | 500 | Card/item title | This app — consolidated from 17–19px card-title variants across the prototype |
| `text-stat` | 28px | normal | -0.02em | 500 | Stat numbers (e.g. "20+ Verified experts") | This app — from `auth-stats b` |
| `text-label` | 12px | normal | normal | 500 | Form field labels | This app — from `auth-field label` |
| `text-caption` | 13px | 1.4 | normal | 400 | Secondary/meta text (pair with `text-ink-3`) | This app — from `auth-foot`, card meta text |
| `text-mono-label` | 11px | normal | 0.12em | 500 | Small-caps tag/label, pairs with `font-mono` | This app — from badges, `auth-logos` city names |

**A note on the "This app" rows:** the prototype has organic size drift for similar elements —
card titles show up as 17px, 18px, *and* 19px in different places, page headings as 28px and 32px.
That's not a deliberate scale, just accumulated inconsistency across many separately-built pages.
Rather than reproduce every variant, these five tokens consolidate them into one number each. If a
future page's mockup uses a size that doesn't fit any existing token, that's a real signal to
either reuse the closest one or deliberately add a new one here — not to reach for `text-[17px]`.

**`text-lede` got the same treatment for the same reason.** The design source itself is
inconsistent about it: most section paragraphs computed to ~18.6px via a shared `.lede` class,
but the homepage hero used its own one-off `.hs-lede` at 16.5px, and a sweep of the actual app
found several section/step intros still hand-rolled at `text-sm` (14px) or `text-[15px]` instead
of using the token at all — the accumulated result read as noticeably smaller/tighter than the
design intends. Fixed by standardizing every genuine section-intro paragraph on `text-lede`,
including the hero, rather than reproducing the design's own split. Don't add a second "hero
lede" variant if a future mockup shows another slightly-different one-off size for this role —
consolidate into this token instead.

Still-fine to use freely: Tailwind's default scale (`text-sm`, `text-xs`, etc.) for genuine
one-offs that aren't part of any recurring pattern — the semantic names above are for anything
that repeats or represents a heading/label *role*, not a ban on every non-token size.

## Radii

`rounded-input` (10px) and `rounded-card` (20px) are custom tokens — everything else maps onto
Tailwind's own default scale, which already lines up with the design's values: `rounded-xl` = 12px
(small cards), `rounded-2xl` = 16px (tables), `rounded-3xl` = 24px (large feature cards),
`rounded-full` (avatars, tabs, chips).

**Every `Button` uses `rounded-input` (10px), app-wide, no per-page exceptions.** This also
happens to match what `design/static_html` itself uses for the vast majority of its buttons
(its generic `.btn`/`.btn-lg` classes) — only two specific spots there (the inline "Request
Consultation" chip, filter/tag chips) are true pills, and that's not worth a second Button
shape for. (A `rounded-full` app-wide version of this was tried first and reverted — 10px was
judged to read cleaner for this audience than a full pill everywhere.) Don't give an
individual Button instance a one-off radius override to match some specific page's mockup —
this was a deliberate, already-settled app-wide call, not a per-page styling decision.

## Components

`apps/frontend/components/ui/` — shared primitives built on the tokens above. **Check here
before writing new markup for a button, card, badge, or labeled form field** — these were
extracted specifically because the same inline Tailwind classes had already been copy-pasted
across several pages (button styling alone was duplicated near-verbatim in the nav, the login
form, and the application wizard before this existed).

| Component | Use for | Notes |
|---|---|---|
| `Button` | Any clickable action | `variant`: `primary` (bg-ink, default), `secondary` (outline), `ghost` — matches the color-combination rules above exactly. `secondary-dark`/`ghost-dark` are the dark-surface counterparts of `secondary`/`ghost` (white/NN opacity instead of the `ink` family) for use on `bg-ink` sections or cards — e.g. the homepage hero's secondary CTA, the dual-CTA dark card. `accent` (`bg-accent`/`border-accent`) is a verified one-off for the homepage hero's *primary* CTA specifically — confirmed against the actual rendered design mockup, not the general primary-button rule below, which still applies everywhere else. `size`: `md` (48px, default) / `sm` (44px, nav contexts). Pass `href` to render as a `next/link` styled identically to a `<button>` — use this instead of hand-styling a `<Link>`. |
| `Input` | A single labeled text/email/password field | Wraps a native `<input>`; `label` and optional `labelRight` (e.g. a "Forgot?" link) are required props. |
| `Select` | A labeled `<select>` | Same label pattern as `Input`; pass `<option>`s as children. |
| `Textarea` | A labeled multi-line field | Same label pattern, plus an optional `hint` line below it. |
| `Card` | A bordered surface/panel | `rounded-card border border-line bg-bg-card`; `padding="lg"` (default, collapses on mobile — also the homepage testimonial cards' size, measured at design's own 36px, close enough to `lg`'s 40px to reuse rather than add a 5th variant), `"md"`, or `"xl"` (56px — design's `.dual-card`, a genuinely bigger card like the homepage's two-way-in split cards). Real variants, not one-off className padding overrides, which fight the existing padding utility at unpredictable specificity. |
| `Badge` | A pill/chip/tag | `variant`: `neutral` (bg-bg-alt), `emphasis` (bg-ink), `brand` (accent-tinted) — the same three chip treatments documented above. |
| `FilterPopover` | Multi/single-select filter control with optional in-list search (directory filters) | `components/ui/FilterPopover.tsx` — native `<select>` (see `Select`) can't do multi-select or in-list search |
| `Eyebrow` | Small-caps label above a section heading | `components/ui/Eyebrow.tsx` — renders the 22×2px accent dash before the label that `design/static_html`'s `.eyebrow::before` has on every section eyebrow (previously missing app-wide — plain text was used instead). `dark` prop dims the label text to `white/55` for dark-surface sections (e.g. Firms Band) — the dash itself always stays accent-colored either way, matching the source. |
| `Modal` | Centered dialog overlay (e.g. the member self-edit forms) | `components/ui/Modal.tsx` — closes on Escape/backdrop click, locks body scroll while open |
| `Sidebar` | The app-wide left nav (desktop, ≥1024px) | `components/layout/Sidebar.tsx` — `bg-ink`, collapsed to a 56px icon rail by default, hover-expands to 248px as a floating overlay (`box-shadow`, doesn't push page content — matches `design/static_html`'s `.d1-sidebar`/`.d1-shell.revealed`, reimplemented as pure CSS `group`/`group-hover:` instead of the source's JS listener). `AppShell`'s content offset (`pl-14`) matches the *collapsed* width, not the hover-expanded one. `SidebarNav`/`SidebarFooter` take a `variant: 'rail' \| 'full'` prop — `'full'` (always-expanded, no hover) is what `MobileDrawer` reuses below 1024px. |
| `PageContainer` | Page content width — wraps every section's inner content | `components/layout/PageContainer.tsx` — `mx-auto max-w-[1520px] px-8 max-[720px]:px-5`, matching `design/static_html`'s `.container-wide` exactly. **The single source of truth for content width** — every page had drifted to a different hand-rolled `max-w-[Npx]` (1150/1200/1360/1520) before this existed, which is what made the article detail page visibly narrower than the rest of the site. Always use this instead of writing `mx-auto max-w-[...] px-...` again; pass extra layout classes (`grid`, `gap-*`, etc.) via `className`. Deliberately narrow single-column reading content (the guest article excerpt preview, the post-application confirmation screen) is a different, intentional design decision, not this component. |

**The rule, same as for tokens:** if a page needs a button/card/badge/field, use these — don't
write the Tailwind classes inline again. If the shape you need doesn't fit any variant here,
that's a signal to add a variant to the component (and this table), not to reach for one-off
classes.

Exception: `components/auth/SsoButton.tsx` keeps its own hand-rolled markup rather than composing
`Button` — its border/background/hover treatment doesn't match any of the three variants above,
and forcing it into `secondary` would have changed its actual rendered appearance. If a real
"outline with a bg-bg-alt hover" variant shows up in more than this one place, add it as a fourth
`Button` variant instead of leaving a second one-off.

Not every existing page has been migrated to these yet — they were extracted from (and
retrofitted into) the pages that already existed when this was written. Treat migrating a
still-inline pattern to `components/ui/` as part of the normal cost of touching that page, not
a separate cleanup task to schedule later.

## Changing something

- **A color, anywhere it's used** → edit the CSS variable in `apps/frontend/app/globals.css`.
- **A type size/weight/spacing, anywhere it's used** → edit the entry in `tailwind.config.ts`'s
  `fontSize`.
- **A button/card/badge/field style, anywhere it's used** → edit the component in
  `apps/frontend/components/ui/`, not the individual page.
- **Adding a genuinely new, recurring size or color** → add it to the relevant table above *and*
  to the config/CSS file in the same change, so this doc never drifts from what the code actually
  has.
