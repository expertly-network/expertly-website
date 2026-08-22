# Shared types

Compiler-enforced version of the "backend API is a fixed contract" rule in `CLAUDE.md`. When a
backend session finalizes an endpoint's contract in `docs/rest-api.md`, it also writes the matching
request/response interfaces here. The frontend session building against that contract imports them
from here instead of redefining its own copy — so a shape mismatch is a type error, not something
that has to be caught by carefully re-reading a markdown doc.

## Hard rule: type-only, always `import type`

Every file in here exports **interfaces/types only** — no runtime values, no enums-as-objects, no
functions, no classes. That's not a style preference, it's load-bearing: both apps reference this
folder via a `@shared/*` path alias, and Next.js's bundler and NestJS's `tsc` build resolve that
alias differently. `import type { Foo } from '@shared/...'` is guaranteed to be erased completely
at compile time by TypeScript itself — no runtime `require`/`import` is ever emitted for it — so it
works identically on both sides regardless of their different bundlers. A regular `import` (not
`import type`) of something from here would silently break the backend build (NestJS's `tsc` step
does not rewrite path aliases in emitted JS — confirmed the hard way earlier in this project; see
git history around `apps/frontend/tsconfig.json`'s own `@/*` alias for the same issue). If you need a
runtime value shared between apps (a constant, an enum with real values), it does not belong here —
duplicate it deliberately on each side, or raise it as a separate discussion.

## Convention

One file per resource, named after it (e.g. `member.ts`, `consultation-request.ts`), each
exporting the DTOs for that resource's endpoints (e.g. `MemberDto`, `MemberListResponse`,
`CreateMemberRequest`). Re-exported from `index.ts`.

A backend session finalizing a new endpoint's contract (per `CLAUDE.md`'s backend/frontend split)
adds the corresponding file here.
