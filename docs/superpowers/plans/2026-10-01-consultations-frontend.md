# Consultations Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up the "Request Consultation" flow end to end in the UI: a working request modal
on the member profile page, a member's received-requests inbox at `/consultation-requests`, and a
requester's sent-requests page at `/my-consultations` — all against the already-shipped backend
contract, plus one small additive backend field (`memberSlug`) needed to make "View Profile" links
work.

**Architecture:** One shared `ConsultationCard` (two variants) avoids duplicating card layout
between the two list pages. Both list pages follow this codebase's established Server-Component-
fetches/Client-Component-owns-interactivity split (`AdminApplicationsPage`/
`AdminApplicationsTable`, `AdminEventsList`). The modal follows `ProfileClient`/
`SectionEditModal`'s existing lifted-state pattern exactly.

**Tech Stack:** Next.js App Router (Server Components for data fetching, Client Components for
interactivity), Tailwind, `components/ui/*` base components, `apiFetch`/`ApiError`.

**Spec:** `docs/superpowers/specs/2026-10-01-consultations-frontend-design.md`

**No test runner exists in this repo.** Every task verifies with `pnpm typecheck` plus a concrete
manual browser check, matching this codebase's established verification method (see the backend
plan's own note on this).

## Global Constraints

- Mobile-first responsive at 375px and 1440px — checked, not assumed (`apps/frontend/CLAUDE.md`).
- Tailwind only, no custom CSS files. Use existing design tokens (`text-ink`/`text-ink-2`/
  `text-ink-3`/`text-ink-4`, `bg-bg-card`/`bg-bg-alt`, `border-line`/`border-line-2`,
  `rounded-card`/`rounded-input`, `text-caption`/`text-title`, `accent`) — no hardcoded hex values.
- All frontend API calls go through `apiFetch` (client) or the `server.ts` fetch pattern (server)
  — never raw `fetch` elsewhere.
- Server Components for data fetching, Client Components for interactivity only.
- Loading/error/empty states required for every page/component (Code Quality Bar).
- `import type` only for everything from `@shared/*`.
- The "Schedule a Call" tab, `resetAt` countdown display, and CSV export beyond the loaded list
  are explicitly out of scope (spec §3) — do not add them.

---

## Backend amendment

### Task 1: Add `memberSlug` to the consultations contract

**Files:**
- Modify: `packages/shared-types/consultation-request.ts`
- Modify: `apps/backend/src/consultations/consultations.repository.ts`
- Modify: `apps/backend/src/consultations/consultations.service.ts`

**Interfaces:**
- Produces: `ConsultationRequestDto.memberSlug?: string | null`, populated on
  `GET /v1/consultations/mine` and `GET /v1/admin/consultations` (same fields
  `memberFirmName`/`memberHeadline`/`memberAvatarUrl` are already populated on) — consumed by
  Task 6 (`MyConsultationsList`)'s "View Profile" link.

- [ ] **Step 1: Add the field to the shared DTO**

In `packages/shared-types/consultation-request.ts`, find:

```ts
  @ApiPropertyOptional({ nullable: true, type: String }) memberFirmName?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) memberHeadline?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) memberAvatarUrl?: string | null;
```

Replace with:

```ts
  @ApiPropertyOptional({ nullable: true, type: String }) memberFirmName?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) memberHeadline?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) memberAvatarUrl?: string | null;
  // The member's profile URL slug (/members/[slug]) — added for the frontend's "View Profile"
  // link on GET /consultations/mine; not part of the original backend contract.
  @ApiPropertyOptional({ nullable: true, type: String }) memberSlug?: string | null;
```

- [ ] **Step 2: Extend the repository's member-firm lookup**

In `apps/backend/src/consultations/consultations.repository.ts`, find:

```ts
const MEMBER_FIRM_COLUMNS = ['profileId:profile_id', 'firmName:firm_name', 'headline'] as const;
export interface MemberFirmRow {
  profileId: string;
  firmName: string | null;
  headline: string | null;
}
```

Replace with:

```ts
const MEMBER_FIRM_COLUMNS = ['profileId:profile_id', 'firmName:firm_name', 'headline', 'slug'] as const;
export interface MemberFirmRow {
  profileId: string;
  firmName: string | null;
  headline: string | null;
  slug: string;
}
```

(`member_profiles.slug` is `not null unique` per `supabase/migrations/0004_tables.sql` — no
nullability change needed beyond what's already there.)

- [ ] **Step 3: Populate it in the service's enrichment**

In `apps/backend/src/consultations/consultations.service.ts`, find (inside
`enrichWithMemberInfo()`):

```ts
      return {
        ...r,
        memberFirmName: firm?.firmName ?? null,
        memberHeadline: firm?.headline ?? null,
        memberAvatarUrl: profile?.avatarUrl ?? null,
      };
```

Replace with:

```ts
      return {
        ...r,
        memberFirmName: firm?.firmName ?? null,
        memberHeadline: firm?.headline ?? null,
        memberAvatarUrl: profile?.avatarUrl ?? null,
        memberSlug: firm?.slug ?? null,
      };
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/backend && pnpm typecheck`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared-types/consultation-request.ts apps/backend/src/consultations/consultations.repository.ts apps/backend/src/consultations/consultations.service.ts
git commit -m "feat(consultations): add memberSlug for frontend profile links"
```

---

## Frontend phase

### Task 2: API client functions

**Files:**
- Create: `apps/frontend/lib/api/consultations.ts`
- Modify: `apps/frontend/lib/api/server.ts`

**Interfaces:**
- Consumes: `apiFetch`/`ApiError` from `./client`, `ConsultationRequestDto`/
  `CreateConsultationRequestRequest`/`UpdateConsultationStatusRequest` from
  `@shared/consultation-request` (Task 1 adds `memberSlug` to the first of these — this task
  doesn't need to know that detail, just imports the type).
- Produces: `createConsultation(body)`, `updateConsultationStatus(id, status)`,
  `getMyConsultationsServer()`, `getReceivedConsultationsServer()` — consumed by Task 3
  (`ConsultationCard`), Task 4 (modal), Task 5, Task 6 (the two list pages).

- [ ] **Step 1: Write `lib/api/consultations.ts`**

```ts
import { apiFetch } from '@/lib/api/client';
import type { ConsultationRequestDto, CreateConsultationRequestRequest } from '@shared/consultation-request';

export function createConsultation(body: CreateConsultationRequestRequest): Promise<ConsultationRequestDto> {
  return apiFetch<ConsultationRequestDto>('/consultations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateConsultationStatus(
  id: string,
  status: 'completed' | 'declined'
): Promise<ConsultationRequestDto> {
  return apiFetch<ConsultationRequestDto>(`/consultations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
```

- [ ] **Step 2: Add server-side fetchers to `lib/api/server.ts`**

Add this import to the top of the file, alongside the other `@shared/*` type imports:

```ts
import type { ConsultationRequestDto } from '@shared/consultation-request';
```

Add these two functions anywhere after `getMyApplicationServer` (matching its exact shape):

```ts
// Returns the caller's own sent consultation requests.
export async function getMyConsultationsServer(): Promise<ConsultationRequestDto[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const res = await fetch(`${getApiBaseUrlServer()}/v1/consultations/mine`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load your consultation requests.', res.status);
  }

  return res.json();
}

// Returns consultation requests received by the caller (member role only — the backend 403s otherwise).
export async function getReceivedConsultationsServer(): Promise<ConsultationRequestDto[]> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];

  const res = await fetch(`${getApiBaseUrlServer()}/v1/consultations/received`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? 'Failed to load consultation requests.', res.status);
  }

  return res.json();
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add apps/frontend/lib/api/consultations.ts apps/frontend/lib/api/server.ts
git commit -m "feat(consultations): add frontend API client functions"
```

---

### Task 3: `ConsultationCard` (shared, two variants)

**Files:**
- Create: `apps/frontend/components/consultations/ConsultationCard.tsx`

**Interfaces:**
- Consumes: `ConsultationRequestDto` (`@shared/consultation-request`), `updateConsultationStatus`
  (Task 2), `Badge`/`Button` (`@/components/ui`), `ApiError` (`@/lib/api/client`), `ErrorBanner`
  (`@/components/auth/ErrorBanner`).
- Produces: `ConsultationCard` component with props `{ variant: 'received', request, onStatusChange:
  (id: string, status: 'completed' | 'declined') => void } | { variant: 'mine', request }` —
  consumed by Task 5 (`ReceivedConsultationsList`) and Task 6 (`MyConsultationsList`).

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { updateConsultationStatus } from '@/lib/api/consultations';
import { ApiError } from '@/lib/api/client';
import type { ConsultationRequestDto, ConsultationStatus } from '@shared/consultation-request';

const STATUS_BADGE_VARIANT: Record<ConsultationStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  completed: 'success',
  declined: 'danger',
};

const STATUS_LABEL: Record<ConsultationStatus, string> = {
  pending: 'Pending',
  completed: 'Completed',
  declined: 'Declined',
};

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function Avatar({ src, alt }: { src: string | null | undefined; alt: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className="h-12 w-12 flex-none rounded-full border border-line object-cover" />;
  }
  return (
    <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-line bg-bg-alt text-ink-4">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

function VerifiedBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-none text-ok" aria-label="Verified">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12.5l2.5 2.5L16 9" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ConsultationCardProps =
  | { variant: 'received'; request: ConsultationRequestDto; onStatusChange: (id: string, status: 'completed' | 'declined') => void }
  | { variant: 'mine'; request: ConsultationRequestDto };

export function ConsultationCard(props: ConsultationCardProps) {
  const { request } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStatusChange(status: 'completed' | 'declined') {
    if (props.variant !== 'received') return;
    setError(null);
    setBusy(true);
    try {
      await updateConsultationStatus(request.id, status);
      props.onStatusChange(request.id, status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update this request.');
      setBusy(false);
    }
  }

  const title = props.variant === 'received' ? request.requesterName : (request.memberName ?? 'Member');
  const avatarSrc = props.variant === 'received' ? request.requesterAvatarUrl : request.memberAvatarUrl;
  const firm = props.variant === 'received' ? request.requesterFirmName : request.memberFirmName;
  const showVerified = props.variant === 'received' ? Boolean(request.requesterIsVerifiedMember) : true;
  const email = props.variant === 'received' ? request.requesterContactEmail : undefined;
  const phone = props.variant === 'received' ? request.requesterPhone : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-bg-card p-5 sm:flex-row">
      <Avatar src={avatarSrc} alt={title} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-title text-ink">{title}</span>
            {showVerified && <VerifiedBadge />}
            {firm && <span className="text-caption text-ink-3">{firm}</span>}
          </div>
          <Badge variant={STATUS_BADGE_VARIANT[request.status]}>{STATUS_LABEL[request.status]}</Badge>
        </div>

        <p className="mt-2 text-sm text-ink-2">{request.message}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-3">
          <span className="inline-flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {DATE_FORMAT.format(new Date(request.createdAt))}
          </span>
          {email && (
            <a href={`mailto:${email}`} className="inline-flex items-center gap-1.5 hover:text-ink hover:underline">
              {email}
            </a>
          )}
          {phone && (
            <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1.5 hover:text-ink hover:underline">
              {phone}
            </a>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {props.variant === 'received' ? (
            <>
              {email && (
                <Button href={`mailto:${email}`} size="sm" variant="secondary">
                  Email
                </Button>
              )}
              {phone && (
                <Button href={`tel:${phone.replace(/[^+\d]/g, '')}`} size="sm" variant="secondary">
                  Call
                </Button>
              )}
              {request.status === 'pending' && (
                <>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleStatusChange('completed')}>
                    {busy ? 'Saving…' : 'Completed'}
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => handleStatusChange('declined')}>
                    Decline
                  </Button>
                </>
              )}
            </>
          ) : (
            request.memberSlug && (
              <Button href={`/members/${request.memberSlug}`} size="sm" variant="secondary">
                View Profile
              </Button>
            )
          )}
        </div>
        {error && <div className="mt-3"><ErrorBanner message={error} /></div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add apps/frontend/components/consultations/ConsultationCard.tsx
git commit -m "feat(consultations): add shared ConsultationCard component"
```

---

### Task 4: `RequestConsultationModal` + wiring into every trigger site

There are **three** existing disabled-stub "Request Consultation" buttons in this codebase, not
two — a grep for the literal string before starting this task confirms the full list:
`ProfileSidebar.tsx`, `MobileCtaBar.tsx` (both on the member detail page), and
`MemberCard.tsx` (the shared card used by both `/members`' directory grid
(`MemberDirectoryList.tsx`) and the homepage's `FeaturedMembers.tsx` — one component, two call
sites, so wiring `MemberCard` itself covers both automatically). Re-run `grep -rln "Request
Consultation" apps/frontend/components apps/frontend/app` yourself before starting and confirm
this is still the complete list — don't trust this plan's count over a fresh grep.

**Files:**
- Create: `apps/frontend/components/consultations/RequestConsultationModal.tsx`
- Modify: `apps/frontend/components/members/ProfileSidebar.tsx`
- Modify: `apps/frontend/components/members/MobileCtaBar.tsx`
- Modify: `apps/frontend/app/(shell)/members/[slug]/ProfileClient.tsx`
- Modify: `apps/frontend/components/members/MemberCard.tsx`

**Interfaces:**
- Consumes: `createConsultation` (Task 2), `Modal`/`Input`/`Textarea`/`Button` (`@/components/ui`),
  `ApiError` (`@/lib/api/client`), `getSessionUser` (`@/lib/auth/session-claims`) — read
  server-side in `ProfileClient`'s parent page, not inside this Client Component (see Step 4).
- Produces: `RequestConsultationModal` with props `{ memberId: string; memberName: string;
  prefillName?: string; prefillEmail?: string; open: boolean; onClose: () => void }`.

- [ ] **Step 1: Write the modal**

```tsx
'use client';

import { useState } from 'react';
import { Modal, Input, Textarea, Button } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { createConsultation } from '@/lib/api/consultations';
import { ApiError } from '@/lib/api/client';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RequestConsultationModal({
  memberId,
  memberName,
  prefillName,
  prefillEmail,
  open,
  onClose,
}: {
  memberId: string;
  memberName: string;
  prefillName?: string;
  prefillEmail?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(prefillName ?? '');
  const [email, setEmail] = useState(prefillEmail ?? '');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function reset() {
    setName(prefillName ?? '');
    setEmail(prefillEmail ?? '');
    setPhone('');
    setMessage('');
    setError(null);
    setSent(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const canSubmit = name.trim() && EMAIL_RE.test(email.trim()) && phone.trim() && message.trim() && !submitting;

  async function handleSubmit() {
    if (!canSubmit) {
      setError('Please fill in your name, email, mobile number, and a description of the work required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await createConsultation({
        memberId,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        message: message.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Request Consultation">
      {sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--ok)_12%,transparent)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12l5 5L20 7" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-title text-ink">Request Sent</p>
          <p className="text-sm text-ink-3">
            Your consultation request has been sent to {memberName}. They&apos;ll respond to you directly.
          </p>
          <Button onClick={handleClose} className="mt-2">
            Close
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="-mt-2 text-sm text-ink-3">with {memberName}</p>
          <Input label="Your Name" placeholder="e.g. Amelia Ross" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
            <Input label="Email Address" type="email" placeholder="you@firm.com" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={200} />
            <Input label="Mobile Number" type="tel" placeholder="+1 212 555 0148" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} />
          </div>
          <Textarea
            label="Description of Work Required"
            placeholder="Describe what you need help with, in as much detail as possible…"
            rows={5}
            maxLength={2000}
            hint={`${message.length} / 2000`}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {error && <ErrorBanner message={error} />}
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={!canSubmit} fullWidth>
              {submitting ? 'Sending…' : 'Send Request'}
            </Button>
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Wire the trigger into `ProfileSidebar`**

In `apps/frontend/components/members/ProfileSidebar.tsx`, add `onRequestConsultation` to the
props and replace the disabled button. Find:

```tsx
export function ProfileSidebar({
  member,
  isOwnProfile,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
}) {
```

Replace with:

```tsx
export function ProfileSidebar({
  member,
  isOwnProfile,
  onRequestConsultation,
}: {
  member: MemberDto;
  isOwnProfile: boolean;
  onRequestConsultation: () => void;
}) {
```

Find:

```tsx
        <Button disabled aria-disabled="true" title="Coming soon" fullWidth className="font-mono font-semibold">
          Request Consultation
        </Button>
```

Replace with:

```tsx
        <Button onClick={onRequestConsultation} fullWidth className="font-mono font-semibold">
          Request Consultation
        </Button>
```

- [ ] **Step 3: Wire the trigger into `MobileCtaBar`**

In `apps/frontend/components/members/MobileCtaBar.tsx`, find:

```tsx
export function MobileCtaBar({ member }: { member: MemberDto }) {
```

Replace with:

```tsx
export function MobileCtaBar({ member, onRequestConsultation }: { member: MemberDto; onRequestConsultation: () => void }) {
```

Find:

```tsx
      <Button disabled aria-disabled="true" title="Coming soon">
        Request Consultation
      </Button>
```

Replace with:

```tsx
      <Button onClick={onRequestConsultation}>
        Request Consultation
      </Button>
```

- [ ] **Step 4: Lift the modal state in `ProfileClient` and read the session for prefill**

This step also needs the signed-in user's name/email to prefill the modal — `ProfileClient` is a
Client Component, so it can't call the server-only `getSessionUser()` itself. The parent Server
Component page already calls it (as `sessionUser`, guarded by an early return when absent, so it's
guaranteed non-null below that point) — pass it down as two new props.

In `apps/frontend/app/(shell)/members/[slug]/page.tsx`, find:

```tsx
  return <ProfileClient member={member} edits={edits} isOwnProfile={isOwnProfile} />;
```

Replace with:

```tsx
  return (
    <ProfileClient
      member={member}
      edits={edits}
      isOwnProfile={isOwnProfile}
      viewerName={`${sessionUser.first_name} ${sessionUser.last_name}`.trim()}
      viewerEmail={sessionUser.email}
    />
  );
```

Then in `apps/frontend/app/(shell)/members/[slug]/ProfileClient.tsx`, find:

```tsx
export function ProfileClient({
  member,
  edits,
  isOwnProfile,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
}) {
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<MemberEditSection | null>(null);
```

Replace with:

```tsx
export function ProfileClient({
  member,
  edits,
  isOwnProfile,
  viewerName,
  viewerEmail,
}: {
  member: MemberDto;
  edits: MemberProfileEditDto[];
  isOwnProfile: boolean;
  viewerName?: string;
  viewerEmail?: string;
}) {
  const router = useRouter();
  const [editingSection, setEditingSection] = useState<MemberEditSection | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
```

Find:

```tsx
        <ProfileSidebar member={member} isOwnProfile={isOwnProfile} />
      </div>
      <MobileCtaBar member={member} />
      <SectionEditModal
```

Replace with:

```tsx
        <ProfileSidebar
          member={member}
          isOwnProfile={isOwnProfile}
          onRequestConsultation={() => setRequestModalOpen(true)}
        />
      </div>
      <MobileCtaBar member={member} onRequestConsultation={() => setRequestModalOpen(true)} />
      <RequestConsultationModal
        memberId={member.id}
        memberName={member.name}
        prefillName={viewerName}
        prefillEmail={viewerEmail}
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
      />
      <SectionEditModal
```

Add the import at the top of the file, alongside the other component imports:

```tsx
import { RequestConsultationModal } from '@/components/consultations/RequestConsultationModal';
```

- [ ] **Step 5: Wire the trigger into `MemberCard`**

Unlike the profile-page buttons, `MemberCard` is rendered inside lists (`MemberDirectoryList`,
`FeaturedMembers`) that have no session already loaded — this trigger opens the modal with blank
fields (no prefill), matching the design prototype's own default behavior anyway (prefill was
this plan's addition for the profile-page flow specifically, not a general requirement). Each
card owns its own local modal-open state — no lifting needed, since cards are independent of each
other.

In `apps/frontend/components/members/MemberCard.tsx`, add `'use client'` as the first line of the
file (it already uses an `onClick` handler on its disabled button, so this is formalizing
existing behavior, not a new constraint) and add `useState` to the React import. Find:

```tsx
import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import { formatRate } from '@/lib/members/format';
import type { MemberListItemDto } from '@shared/member';
```

Replace with:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Badge, Button } from '@/components/ui';
import { formatRate } from '@/lib/members/format';
import { RequestConsultationModal } from '@/components/consultations/RequestConsultationModal';
import type { MemberListItemDto } from '@shared/member';
```

Find the function body's opening line:

```tsx
export function MemberCard({ member }: { member: MemberListItemDto }) {
  const location = [member.city, member.country].filter(Boolean).join(', ');
```

Replace with:

```tsx
export function MemberCard({ member }: { member: MemberListItemDto }) {
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const location = [member.city, member.country].filter(Boolean).join(', ');
```

Find the disabled button:

```tsx
          <Button
            size="sm"
            disabled
            aria-disabled="true"
            title="Coming soon — consultations aren't live yet"
            className="ml-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            Request Consultation
          </Button>
```

Replace with:

```tsx
          <Button
            size="sm"
            className="ml-auto"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setRequestModalOpen(true);
            }}
          >
            Request Consultation
          </Button>
```

The `e.preventDefault()`/`e.stopPropagation()` stay — the whole card is a `<Link>` to the profile
page, and this button must open the modal in place rather than navigating away first.

The modal must be a sibling of `<Link>` (a component can't return two adjacent top-level
elements without a wrapping fragment) — this means wrapping the existing `<Link>...</Link>` block
in `<>...</>` without touching anything inside it. Two separate, narrow edits do this without
reproducing the whole card body:

Find the return statement's opening (exactly these two lines):

```tsx
  return (
    <Link
```

Replace with:

```tsx
  return (
    <>
      <Link
```

(this also shifts `<Link>`'s own indentation one level deeper — the diff tool/editor you use to
make this change should re-indent the rest of the `<Link>` block to match; if it doesn't
auto-reindent, the extra two-space indent is cosmetic only and won't break anything, but fix it
for readability before committing.)

Find the component's closing (exactly these three lines, unchanged since the start of this file):

```tsx
    </Link>
  );
}
```

Replace with:

```tsx
      </Link>
      <RequestConsultationModal
        memberId={member.id}
        memberName={member.name}
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
      />
    </>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/components/consultations/RequestConsultationModal.tsx apps/frontend/components/members/ProfileSidebar.tsx apps/frontend/components/members/MobileCtaBar.tsx apps/frontend/components/members/MemberCard.tsx "apps/frontend/app/(shell)/members/[slug]/ProfileClient.tsx" "apps/frontend/app/(shell)/members/[slug]/page.tsx"
git commit -m "feat(consultations): wire up the request consultation modal"
```

---

### Task 5: Middleware + `ConsultationStats` + `ReceivedConsultationsList` + `/consultation-requests` page

One task, not split further — the page can't typecheck without the list component it renders, so
splitting them would leave an intermediate commit that fails its own verification step.

**Files:**
- Modify: `apps/frontend/middleware.ts`
- Create: `apps/frontend/components/consultations/ConsultationStats.tsx`
- Create: `apps/frontend/components/consultations/ReceivedConsultationsList.tsx`
- Create: `apps/frontend/app/(shell)/consultation-requests/page.tsx`

**Interfaces:**
- Consumes: `getSessionUser` (`@/lib/auth/session-claims`), `getReceivedConsultationsServer`
  (Task 2), `PageContainer` (`@/components/layout/PageContainer`), `Eyebrow`/`Input`/`Button`
  (`@/components/ui`), `ConsultationCard` (Task 3).
- Produces: `ConsultationStats` component with props `{ total: number; pending: number; completed:
  number; declined: number }` — consumed by Task 6 (`MyConsultationsList`) too.
  `ReceivedConsultationsList` with props `{ initialRequests: ConsultationRequestDto[] }`.

- [ ] **Step 1: Add both new paths to the protected-routes middleware**

In `apps/frontend/middleware.ts`, find:

```ts
// Routes that require a signed-in user. Add more prefixes here as new protected
// pages ship (e.g. '/peer-connect', '/my-consultations').
const PROTECTED_PREFIXES = ['/dashboard', '/apply', '/admin', '/articles/write'];
```

Replace with:

```ts
// Routes that require a signed-in user. Add more prefixes here as new protected
// pages ship (e.g. '/peer-connect').
const PROTECTED_PREFIXES = ['/dashboard', '/apply', '/admin', '/articles/write', '/consultation-requests', '/my-consultations'];
```

- [ ] **Step 2: Write the shared `ConsultationStats` component**

```tsx
export function ConsultationStats({
  total,
  pending,
  completed,
  declined,
}: {
  total: number;
  pending: number;
  completed: number;
  declined: number;
}) {
  const tiles = [
    { label: 'Total', value: total },
    { label: 'Pending', value: pending },
    { label: 'Completed', value: completed },
    { label: 'Declined', value: declined },
  ];
  return (
    <div className="grid grid-cols-4 gap-3 max-[640px]:grid-cols-2">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-xl border border-line bg-bg-card p-4">
          <div className="text-2xl font-bold text-ink">{tile.value}</div>
          <div className="text-caption text-ink-3">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Write `ReceivedConsultationsList`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Input, Button } from '@/components/ui';
import { ConsultationCard } from '@/components/consultations/ConsultationCard';
import { ConsultationStats } from '@/components/consultations/ConsultationStats';
import type { ConsultationRequestDto, ConsultationStatus } from '@shared/consultation-request';

type Filter = 'all' | ConsultationStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
];

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function downloadTranscript(requests: ConsultationRequestDto[]) {
  const headers = ['Requester', 'Firm', 'Message', 'Email', 'Phone', 'Received', 'Status'];
  const rows = requests.map((r) => [
    r.requesterName,
    r.requesterFirmName ?? '',
    r.message,
    r.requesterContactEmail,
    r.requesterPhone,
    new Date(r.createdAt).toLocaleDateString('en-US'),
    r.status,
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expertly-consultation-transcript-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ReceivedConsultationsList({ initialRequests }: { initialRequests: ConsultationRequestDto[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      completed: requests.filter((r) => r.status === 'completed').length,
      declined: requests.filter((r) => r.status === 'declined').length,
    }),
    [requests]
  );

  const filtered = useMemo(() => {
    let pool = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      pool = pool.filter(
        (r) => r.requesterName.toLowerCase().includes(q) || (r.requesterFirmName ?? '').toLowerCase().includes(q)
      );
    }
    return pool;
  }, [requests, filter, query]);

  function handleStatusChange(id: string, status: 'completed' | 'declined') {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="flex flex-col gap-6">
      <ConsultationStats {...counts} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors ${
                filter === f.key ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:border-ink-3'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-3 min-[640px]:flex-none min-[640px]:w-auto">
          <Input
            label=""
            placeholder="Search by name or firm…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full min-[640px]:w-64"
          />
          {requests.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => downloadTranscript(requests)}>
              Download transcript
            </Button>
          )}
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">No consultation requests yet.</p>
      ) : filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          No requests match this view. Try a different status filter or clear the search.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((request) => (
            <ConsultationCard key={request.id} variant="received" request={request} onStatusChange={handleStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}
```

`Input`'s `label` prop is required by its type but this toolbar wants a bare search field with no
visible label — pass `label=""` (the component renders an empty `<label>` row; acceptable here
since every other `Input` usage in this codebase always has a visible label, so there's no
existing "labelless search input" variant to reuse — if this looks wrong once rendered, wrap a
visually-hidden label instead, noted as a judgment call for whoever implements this step).

- [ ] **Step 4: Write the page**

```tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getReceivedConsultationsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { ReceivedConsultationsList } from '@/components/consultations/ReceivedConsultationsList';

export const metadata = {
  title: 'Consultation Requests — Expertly',
};

// UX-only gate; the backend re-checks (403s non-members on /consultations/received) on every request.
export default async function ConsultationRequestsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/consultation-requests');
  }
  if (profile.role !== 'member') {
    redirect('/my-consultations');
  }

  const requests = await getReceivedConsultationsServer();

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Member Portal</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Consultation requests</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Every request a prospective client has sent through your Expertly profile, in one
            place.
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <ReceivedConsultationsList initialRequests={requests} />
        </PageContainer>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/middleware.ts apps/frontend/components/consultations/ConsultationStats.tsx apps/frontend/components/consultations/ReceivedConsultationsList.tsx "apps/frontend/app/(shell)/consultation-requests/page.tsx"
git commit -m "feat(consultations): add /consultation-requests page"
```

---

### Task 6: `/my-consultations` page + `MyConsultationsList`

**Files:**
- Create: `apps/frontend/app/(shell)/my-consultations/page.tsx`
- Create: `apps/frontend/components/consultations/MyConsultationsList.tsx`

**Interfaces:**
- Consumes: `getSessionUser`, `getMyConsultationsServer` (Task 2), `ConsultationCard` (Task 3),
  `ConsultationStats` (Task 5), `Input` (`@/components/ui`).

- [ ] **Step 1: Write the page**

```tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getMyConsultationsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { MyConsultationsList } from '@/components/consultations/MyConsultationsList';

export const metadata = {
  title: 'My Consultations — Expertly',
};

// UX-only gate; a member-role session is redirected to the inbox they actually use, matching
// the design prototype's own my-consultations.html → consultation-requests.html redirect.
export default async function MyConsultationsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/my-consultations');
  }
  if (profile.role === 'member') {
    redirect('/consultation-requests');
  }

  const requests = await getMyConsultationsServer();

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Your account</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">My consultations</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Every consultation request you&apos;ve sent to a member through their Expertly
            profile, in one place.
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <MyConsultationsList initialRequests={requests} />
        </PageContainer>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Write `MyConsultationsList`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Input, Button } from '@/components/ui';
import { ConsultationCard } from '@/components/consultations/ConsultationCard';
import { ConsultationStats } from '@/components/consultations/ConsultationStats';
import type { ConsultationRequestDto, ConsultationStatus } from '@shared/consultation-request';

type Filter = 'all' | ConsultationStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
];

export function MyConsultationsList({ initialRequests }: { initialRequests: ConsultationRequestDto[] }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      total: initialRequests.length,
      pending: initialRequests.filter((r) => r.status === 'pending').length,
      completed: initialRequests.filter((r) => r.status === 'completed').length,
      declined: initialRequests.filter((r) => r.status === 'declined').length,
    }),
    [initialRequests]
  );

  const filtered = useMemo(() => {
    let pool = filter === 'all' ? initialRequests : initialRequests.filter((r) => r.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      pool = pool.filter(
        (r) => (r.memberName ?? '').toLowerCase().includes(q) || (r.memberFirmName ?? '').toLowerCase().includes(q)
      );
    }
    return pool;
  }, [initialRequests, filter, query]);

  if (initialRequests.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-sm text-ink-3">You haven&apos;t requested a consultation yet.</p>
        <Button href="/members">Browse Members</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ConsultationStats {...counts} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full border px-3.5 py-1.5 text-caption font-medium transition-colors ${
                filter === f.key ? 'border-ink bg-ink text-bg' : 'border-line text-ink-2 hover:border-ink-3'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Input
          label=""
          placeholder="Search by member or firm…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full min-[640px]:w-64"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sm text-ink-3">
          No requests match this view. Try a different status filter or clear the search.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((request) => (
            <ConsultationCard key={request.id} variant="mine" request={request} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/frontend && pnpm typecheck`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add "apps/frontend/app/(shell)/my-consultations/page.tsx" apps/frontend/components/consultations/MyConsultationsList.tsx
git commit -m "feat(consultations): add /my-consultations page"
```

---

### Task 7: Frontend manual verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck everything together**

Run: `cd apps/frontend && pnpm typecheck && cd ../backend && pnpm typecheck`
Expected: both pass.

- [ ] **Step 2: Start the dev server**

Run: `pnpm dev` (from the repo root — starts both apps via Turborepo)
Expected: both apps start with no errors.

- [ ] **Step 3: Request modal, end to end — all four trigger sites**

As a signed-in `client`-role account: visit a member's profile, click "Request Consultation"
(desktop sidebar and, at a narrow viewport, the mobile sticky bar), confirm name/email are
prefilled from the session and phone/message are blank, submit with all fields valid — expect
the in-modal "Request Sent" confirmation. Try submitting with a field missing — expect the inline
validation message, no request sent.

Then check the other two trigger sites, which share `MemberCard` and open the modal with blank
fields (no prefill, by design — see Task 4 Step 5): the `/members` directory grid and the
homepage's "Featured Members" section. Click "Request Consultation" on a card in each — confirm
the modal opens in place (the card does **not** navigate to the profile page first) and submits
successfully.

- [ ] **Step 4: Received inbox**

As the `member` whose profile received that request: visit `/consultation-requests` — confirm the
new request appears with `status: pending`, stat tiles reflect it, Email/Call links use the
submitted contact details (not the member's own). Click "Completed" on it — confirm it moves to
the Completed filter and the buttons disappear (no longer `pending`).

- [ ] **Step 5: Sent list**

As the original `client` requester: visit `/my-consultations` — confirm the same request now
shows `status: completed`, and "View Profile" links to the correct member's profile page (uses
`memberSlug` from Task 1 — if this link 404s or goes nowhere, Task 1's backend change didn't
actually land; check it before debugging the frontend).

- [ ] **Step 6: Role gates**

As a `member`-role session, visit `/my-consultations` directly — expect an immediate redirect to
`/consultation-requests`. As a `client`-role session, visit `/consultation-requests` directly —
expect a redirect to `/my-consultations`. Signed out, visit either — expect a redirect to
`/login?returnTo=...`.

- [ ] **Step 7: Empty states**

With a fresh `client` account that's never sent a request: `/my-consultations` shows the
"You haven't requested a consultation yet" empty state with a working "Browse Members" link. With
a `member` account that's never received one: `/consultation-requests` shows "No consultation
requests yet."

- [ ] **Step 8: Responsive — 375px and 1440px**

Check all three surfaces (modal, `/consultation-requests`, `/my-consultations`) at both widths:
stat tiles reflow to 2×2 at narrow widths, filter tabs/search don't overflow, cards stack cleanly,
the modal's two-column email/phone row collapses to one column below 480px.
