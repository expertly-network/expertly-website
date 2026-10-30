# Shared types

Compiler-enforced version of the "backend API is a fixed contract" rule in `CLAUDE.md`. When a
backend session finalizes an endpoint's contract in `docs/rest-api.md`, it also writes the matching
request/response interfaces here. The frontend session building against that contract imports them
from here instead of redefining its own copy — so a shape mismatch is a type error, not something
that has to be caught by carefully re-reading a markdown doc.

## How it's consumed — the two sides differ on purpose

The DTOs here are **classes decorated with `@nestjs/swagger`'s `@ApiProperty()`**, not plain
interfaces, so the backend's generated Swagger docs (`/api`) describe the real response shapes:

- **Backend** imports them as **values** where Swagger needs the class (`@ApiOkResponse({ type })`,
  controller return types) and with `import type` everywhere else. `nest build` resolves the
  `@shared/*` alias and `tsc-alias` (`apps/backend/scripts/postbuild.mjs`) rewrites it in the emitted
  JS — so a value import is safe there.
- **Frontend** must only ever use **`import type`** from `@shared/*` (enforced by convention and
  checked in review): that is fully erased at compile time, so neither the decorators nor
  `@nestjs/swagger` ever reach the browser bundle. A value import would pull Nest's Swagger runtime
  into Next.js.

Keep files to DTO classes, request/response types and string-literal unions — no functions, no
runtime constants. A runtime value shared by both apps (a limit, an allowlist) is duplicated
deliberately on each side with a comment pointing at its twin (e.g. `MEMBER_UPLOAD_CONTENT_TYPES`
in `apps/backend/src/members/dto/create-upload.dto.ts` ↔ `apps/frontend/lib/api/members.ts`).

Backend **request** DTOs (`apps/backend/src/**/dto/*.dto.ts`, the class-validator classes) are
separate classes from the request types here; keep their fields identical — when adding one, write
it here first, then the validated backend class with the same fields.

## Convention

One file per resource, named after it (e.g. `member.ts`, `consultation-request.ts`), each
exporting the DTOs for that resource's endpoints (e.g. `MemberDto`, `MemberListResponse`,
`CreateMemberRequest`). Re-exported from `index.ts`.

A backend session finalizing a new endpoint's contract (per `CLAUDE.md`'s backend/frontend split)
adds the corresponding file here. `errors.ts` holds `ApiErrorResponse`, the one error body every
endpoint returns (`apps/backend/src/common/http-exception.filter.ts`).
