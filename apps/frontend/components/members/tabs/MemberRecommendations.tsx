'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Textarea } from '@/components/ui';
import { ApiError, apiFetch } from '@/lib/api/client';
import { createClient } from '@/lib/supabase/client';
import { formatMonthYear } from '@/lib/members/format';
import type {
  CreateRecommendationRequest,
  MemberRecommendationDto,
  UpdateRecommendationRequest,
} from '@shared/member';

const MIN_LEN = 10;
const MAX_LEN = 2000;

// Mirrors the backend's error codes so each failure gets a specific message.
const POST_ERRORS: Record<number, string> = {
  403: 'Only active members can write recommendations, and not for themselves.',
  404: 'This member can no longer receive recommendations.',
  409: 'You have already recommended this member.',
};

/** Reads `app_role` and `sub` off the current session's JWT (display gating only; the API enforces it). */
async function readViewer(): Promise<{ role: string | null; id: string | null }> {
  try {
    const {
      data: { session },
    } = await createClient().auth.getSession();
    if (!session) return { role: null, id: null };
    const payload = session.access_token.split('.')[1];
    if (!payload) return { role: null, id: null };
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const claims = JSON.parse(json) as { app_role?: string; sub?: string };
    return { role: claims.app_role ?? null, id: claims.sub ?? null };
  } catch {
    return { role: null, id: null };
  }
}

export function MemberRecommendations({
  memberId,
  memberName,
  isOwnProfile,
}: {
  memberId: string;
  memberName: string;
  isOwnProfile: boolean;
}) {
  const [items, setItems] = useState<MemberRecommendationDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await apiFetch<MemberRecommendationDto[]>(`/members/${memberId}/recommendations`));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load recommendations.');
    }
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    void readViewer().then(({ role, id }) => {
      if (cancelled) return;
      setCanWrite(role === 'member');
      setViewerId(id);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const trimmed = body.trim();
  const tooShort = trimmed.length < MIN_LEN;

  async function submit() {
    if (tooShort || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: CreateRecommendationRequest = { body: trimmed };
      const created = await apiFetch<MemberRecommendationDto>(`/members/${memberId}/recommendations`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setItems((prev) => [created, ...(prev ?? [])]);
      setBody('');
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(POST_ERRORS[err.statusCode] ?? err.message);
        if (err.statusCode === 409) void load();
      } else {
        setFormError('Could not publish your recommendation. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleHidden(rec: MemberRecommendationDto) {
    setBusyId(rec.id);
    setActionError(null);
    try {
      const payload: UpdateRecommendationRequest = { isHidden: !rec.isHidden };
      const updated = await apiFetch<MemberRecommendationDto>(
        `/members/${memberId}/recommendations/${rec.id}`,
        { method: 'PATCH', body: JSON.stringify(payload) }
      );
      setItems((prev) => (prev ?? []).map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Could not update this recommendation.');
    } finally {
      setBusyId(null);
    }
  }

  // One recommendation per author per member.
  const alreadyWritten = viewerId !== null && (items ?? []).some((r) => r.author.id === viewerId);
  const showForm = canWrite && !isOwnProfile && !alreadyWritten && items !== null;

  return (
    <section aria-labelledby="member-recommendations-heading">
      <h3 id="member-recommendations-heading" className="mb-3 font-mono text-profile-label font-bold text-ink-3">
        Member Recommendations
      </h3>

      {items === null && !loadError && (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading recommendations">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-line bg-bg-alt" />
          ))}
        </div>
      )}

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-panel border border-line bg-bg-alt px-4 py-3 text-profile-item text-ink-2">
          <span>{loadError}</span>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {actionError && (
        <p role="alert" className="mb-3 text-caption text-red-600">
          {actionError}
        </p>
      )}

      {items !== null && items.length === 0 && (
        <p className="text-profile-item text-ink-3">
          {isOwnProfile
            ? 'No recommendations yet. Fellow members can recommend you from your profile.'
            : `No recommendations for ${memberName} yet.`}
        </p>
      )}

      {items !== null && items.length > 0 && (
        <ul className="flex flex-col gap-3">
          {items.map((rec) => (
            <li
              key={rec.id}
              className={`rounded-2xl border border-line bg-bg-card px-5 py-4 ${rec.isHidden ? 'opacity-70' : ''}`}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2.5">
                {rec.author.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={rec.author.photoUrl} alt="" className="h-9 w-9 flex-none rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--accent)_15%,transparent)] font-mono text-xs font-bold text-accent">
                    {rec.author.initials}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <a href={`/members/${rec.author.slug}`} className="block truncate text-[13.5px] font-semibold text-ink hover:underline">
                    {rec.author.name}
                  </a>
                  <span className="font-mono text-[10.5px] text-ink-4">{formatMonthYear(rec.createdAt)}</span>
                </div>
                {rec.isHidden && (
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    Hidden from your profile
                  </span>
                )}
                {isOwnProfile && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === rec.id}
                    onClick={() => void toggleHidden(rec)}
                  >
                    {busyId === rec.id ? 'Saving…' : rec.isHidden ? 'Show' : 'Hide'}
                  </Button>
                )}
              </div>
              <p className="whitespace-pre-line text-profile-body leading-normal text-ink-2">{rec.body}</p>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <form
          className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-bg-alt p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Textarea
            label={`Recommend ${memberName}`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_LEN}
            rows={4}
            placeholder="Share what it was like to work with them. Published immediately."
            hint={`${trimmed.length}/${MAX_LEN} characters (minimum ${MIN_LEN}). You can write one recommendation per member.`}
            error={formError ?? undefined}
          />
          <div>
            <Button type="submit" disabled={tooShort || submitting}>
              {submitting ? 'Publishing…' : 'Publish recommendation'}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
