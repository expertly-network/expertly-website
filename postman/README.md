# Expertly Postman collection

`Expertly.postman_collection.json` covers every route in `apps/backend` (67 requests). Structure
and naming follow two fixed principles — **read these before adding or editing anything**:

1. **Role is the primary split, resource is secondary.** Public/member folders (Categories &
   Services, Membership Applications, Articles, Events, Member Directory & Profiles,
   Consultations) hold only non-admin requests. Every 🛡️ admin-only route lives in the single
   top-level **Admin** folder instead, in a sub-folder named after the same resource (e.g. public
   `Articles` vs. `Admin → Articles`) — never mixed into the public/member folder it'd otherwise
   belong to. This keeps a resource folder from being cluttered with routes only an admin can call.
2. **One request per endpoint, even when the backend behavior branches on body content.**
   Endpoints like "approve or reject an application" are **one** request, not two. The shipped
   body is the primary/most-common variant (valid, sendable as-is); the alternate variant's full
   JSON is written into that request's **Description** as a ready-to-paste block, labeled "To test
   X instead, replace the whole body with: \`\`\`json ... \`\`\`". This is deliberately not inline
   `//` comments in the body — real JSON has no comment syntax, and the backend's
   `forbidNonWhitelisted: true` `ValidationPipe` (`apps/backend/src/main.ts`) would reject a
   dormant sibling key sitting next to the active payload, so there's no way to keep both variants
   in the body at once and just toggle one. Copy-paste-from-description is the safe equivalent.

Every request is named `METHOD /route — why` (e.g. `POST /admin/categories — Create category`),
so the exact route is readable in the sidebar without opening the request — Postman's own
method-color tag is not relied on for this.

Plus an unauthenticated `Health & Account` folder (all non-admin smoke tests; `GET /admin/ping`
lives in `Admin` instead, same rule as above) and an `Auth (Supabase)` folder that mints a real JWT
so the whole thing is runnable without the frontend.

## Setup (one-time)

1. Import both files into Postman: `Expertly.postman_collection.json` and
   `Expertly.postman_environment.json`.
2. Select the **Expertly Local** environment (top-right environment picker).
3. Fill in, from your `apps/backend/.env` / `apps/frontend/.env`:
   - `supabaseUrl` → `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
   - `supabaseAnonKey` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `testEmail` / `testPassword` → an existing Supabase user in your project (sign up via the
     frontend first if you don't have one)
4. Leave `baseUrl` as `http://localhost:4000/v1` for local dev (matches `PORT=4000` +
   `app.setGlobalPrefix('v1')`), or point it at a deployed backend origin.

## Running requests

1. Run **Auth (Supabase) → Sign in** once. Its test script auto-saves a real `access_token` into
   the environment's `accessToken` variable — every other request inherits it as a Bearer token
   automatically (collection-level auth), so you never paste a token by hand.
2. Most list endpoints (`GET /categories`, `GET /admin/applications`, `GET /admin/events`, ...)
   return real ids in their response. Copy those into the matching environment variable
   (`categoryId`, `serviceId`, `applicationId`, `articleId`, `aiGenerationId`, `eventId`, `memberId`, `memberSlug`,
   `consultationId`, `memberEditId`) to drive the detail/update/delete requests instead of the
   placeholder UUIDs they ship with.
3. Every request body is a realistic, editable mock matching the DTO in
   `packages/shared-types/` — edit in place and hit Send.
4. For a request whose description says "To test X instead, replace the whole body with: ...",
   open the Description panel, copy that JSON block, and paste it over the Body tab's contents —
   don't try to uncomment anything inline (see principle 2 above for why).

## ⚠️ Keeping this in sync — non-negotiable

This collection is **derived from the fixed contract** in `docs/rest-api.md` +
`packages/shared-types/`, not the other way around. Per root `CLAUDE.md`:

> Whenever an endpoint is added, removed, or changes shape — a new route, a renamed/added/removed
> field, a changed enum, a new required query param — update this collection in the **same**
> change that touches `docs/rest-api.md` / `packages/shared-types/`. A PR that changes the backend
> contract without touching `postman/Expertly.postman_collection.json` is incomplete.

That update follows the two principles at the top of this file:

- **New admin-only endpoint** → add it to the matching resource sub-folder inside `Admin` (create
  a new sub-folder if it's a genuinely new resource area), never into the public/member folder of
  the same name.
- **New endpoint whose behavior branches on body content** (an approve/reject, verify/reject,
  complete/decline, or similar status-driven split) → one request, primary variant as the body,
  every other variant appended to the Description as a ready-to-paste JSON block — don't add a
  second near-duplicate request.
- **Name it** `METHOD /route — why`.

In practice: add/edit the matching request in Postman itself (Content-Type headers, query params,
and a realistic mock body — not an empty one), then **Export** the collection
(`...` menu → Export → Collection v2.1) back over this file, or hand-edit the JSON directly for a
small change. Keep `Expertly.postman_environment.json` in sync too if you add a new resource-id
variable.
