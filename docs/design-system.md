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
| `nav-green` | `#0B3A2D` | Nav & footer brand chrome — a distinct dark green, not `ink` |

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

## Typography scale

All defined in `tailwind.config.ts`'s `fontSize` — use the class name, get size + line-height +
letter-spacing + weight together.

| Class | Size | Line-height | Tracking | Weight | Use | Origin |
|---|---|---|---|---|---|---|
| `text-eyebrow` | 11px | normal | 0.14em | 500 | Small-caps label above a heading | theme.css `.eyebrow` |
| `text-display` | 44–96px (clamp) | 0.98 | -0.03em | 500 | Hero/marketing display text | theme.css `.display` |
| `text-headline` | 32–56px (clamp) | 1.04 | -0.025em | 500 | Major section headline | theme.css `.headline` |
| `text-section-title` | 28–44px (clamp) | 1.08 | -0.02em | 500 | Section heading | theme.css `.section-title` |
| `text-lede` | 17–20px (clamp) | 1.5 | -0.005em | 400 | Intro/lede paragraph (pair with `text-ink-3`) | theme.css `.lede` |
| `text-heading` | 32px | 1.1 | -0.02em | 500 | Page/card heading (e.g. `/login`'s "Get started with Expertly.") | This app — consolidated from `auth-title` and similar 28–32px headings |
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

Still-fine to use freely: Tailwind's default scale (`text-sm`, `text-xs`, etc.) for genuine
one-offs that aren't part of any recurring pattern — the semantic names above are for anything
that repeats or represents a heading/label *role*, not a ban on every non-token size.

## Radii

`rounded-input` (10px) and `rounded-card` (20px) are custom tokens — everything else maps onto
Tailwind's own default scale, which already lines up with the design's values: `rounded-lg` = 8px
(buttons, chips), `rounded-xl` = 12px (small cards), `rounded-2xl` = 16px (tables), `rounded-3xl` =
24px (large feature cards), `rounded-full` (pills, avatars, tabs).

## Components

`apps/frontend/components/ui/` — shared primitives built on the tokens above. **Check here
before writing new markup for a button, card, badge, or labeled form field** — these were
extracted specifically because the same inline Tailwind classes had already been copy-pasted
across several pages (button styling alone was duplicated near-verbatim in the nav, the login
form, and the application wizard before this existed).

| Component | Use for | Notes |
|---|---|---|
| `Button` | Any clickable action | `variant`: `primary` (bg-ink, default), `secondary` (outline), `ghost` — matches the color-combination rules above exactly. `size`: `md` (48px, default) / `sm` (44px, nav contexts). Pass `href` to render as a `next/link` styled identically to a `<button>` — use this instead of hand-styling a `<Link>`. |
| `Input` | A single labeled text/email/password field | Wraps a native `<input>`; `label` and optional `labelRight` (e.g. a "Forgot?" link) are required props. |
| `Select` | A labeled `<select>` | Same label pattern as `Input`; pass `<option>`s as children. |
| `Textarea` | A labeled multi-line field | Same label pattern, plus an optional `hint` line below it. |
| `Card` | A bordered surface/panel | `rounded-card border border-line bg-bg-card`; `padding="lg"` (default, collapses on mobile) or `"md"`. |
| `Badge` | A pill/chip/tag | `variant`: `neutral` (bg-bg-alt), `emphasis` (bg-ink), `brand` (accent-tinted) — the same three chip treatments documented above. |

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
