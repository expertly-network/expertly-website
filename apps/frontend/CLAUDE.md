# Expertly frontend (`apps/frontend/`)

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

## Contract, not guesswork

Import request/response shapes from `@shared/*` (`packages/shared-types/`) with `import type` —
never redefine a copy of a DTO locally. If a page needs data the current API doesn't provide, that
is a contract gap to flag back (see root CLAUDE.md), not something to patch around client-side
(e.g. fetching extra fields from Supabase directly to fill the gap).

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
