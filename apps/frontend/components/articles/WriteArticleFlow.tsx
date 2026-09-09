'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { Eyebrow } from '@/components/ui';
import { WriteOptionCard } from '@/components/articles/WriteOptionCard';
import { ManualArticleForm, EMPTY_MANUAL_ARTICLE_FORM, type ManualArticleFormState } from '@/components/articles/ManualArticleForm';
import { AiDraftWizard } from '@/components/articles/AiDraftWizard';
import { ArticleLivePreview } from '@/components/articles/ArticleLivePreview';
import { WriteSuccess } from '@/components/articles/WriteSuccess';
import { createArticle, updateArticle, getCoverImageSuggestions } from '@/lib/api/articles';
import { ApiError } from '@/lib/api/client';
import type { PracticeAreaDto } from '@shared/practice-area';
import type { ArticleDto } from '@shared/article';

type Step = 'choose' | 'manual' | 'ai' | 'preview' | 'success';

function toManualFormState(article: ArticleDto): ManualArticleFormState {
  return {
    title: article.title,
    practiceAreaIds: article.practiceAreas.map((p) => p.id),
    countries: article.countries,
    state: article.state ?? '',
    body: article.body,
    coverImageUrl: article.coverImageUrl,
  };
}

const UPLOAD_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <path d="M12 18v-6M9.5 14.5L12 12l2.5 2.5" />
  </svg>
);
const AI_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

// Matches design/static_html/articles.html's `#anv-write-panel` step model exactly: choose a
// path -> that path's form -> a preview shared by both paths -> success. One route
// (/articles/write), client-side step state — same in-page-flow shape as the prototype rather
// than a route per step.
export function WriteArticleFlow({
  practiceAreas,
  authorName,
  editArticle,
}: {
  practiceAreas: PracticeAreaDto[];
  authorName: string;
  editArticle?: ArticleDto | null;
}) {
  const router = useRouter();
  const isEditing = Boolean(editArticle);
  const [step, setStep] = useState<Step>(editArticle ? 'manual' : 'choose');
  const [manual, setManual] = useState<ManualArticleFormState>(
    editArticle ? toManualFormState(editArticle) : EMPTY_MANUAL_ARTICLE_FORM
  );
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArticleDto | null>(null);

  function updateManual(patch: Partial<ManualArticleFormState>) {
    setManual((prev) => ({ ...prev, ...patch }));
  }

  async function saveDraft() {
    setError(null);
    setSavingDraft(true);
    try {
      const payload = {
        title: manual.title,
        body: manual.body,
        coverImageUrl: manual.coverImageUrl,
        practiceAreaIds: manual.practiceAreaIds,
        countries: manual.countries,
        state: manual.state || undefined,
        status: 'draft' as const,
      };
      if (editArticle) {
        await updateArticle(editArticle.id, payload);
        router.push(`/articles/${editArticle.id}`);
      } else {
        await createArticle({ ...payload, creationMode: 'manual' });
        router.push('/articles');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save draft.');
    } finally {
      setSavingDraft(false);
    }
  }

  // Editing an already-live article (published/pending_review) omits `status` entirely so the
  // PATCH is a pure content edit — the backend only touches status when the field is present
  // (see ArticlesService.update). A draft or rejected article being edited still needs to go
  // through the same 'draft' vs. "submit" resolution as a brand-new article.
  async function submitManual() {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        title: manual.title,
        body: manual.body,
        coverImageUrl: manual.coverImageUrl,
        practiceAreaIds: manual.practiceAreaIds,
        countries: manual.countries,
        state: manual.state || undefined,
      };
      if (editArticle) {
        const isLive = editArticle.status === 'published' || editArticle.status === 'pending_review';
        const article = await updateArticle(editArticle.id, isLive ? payload : { ...payload, status: 'published' });
        router.push(`/articles/${article.id}`);
      } else {
        const article = await createArticle({ ...payload, creationMode: 'manual' });
        setResult(article);
        setStep('success');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'success' && result) {
    return <WriteSuccess status={result.status} articleId={result.id} />;
  }

  // Editing an already-live article gets a single "Save changes" action (status untouched); a
  // rejected one gets "Resubmit" (same submit resolution as a brand-new article); draft editing
  // keeps the normal "Publish" copy since it's going through the same resolution too.
  const isLiveEdit =
    isEditing && (editArticle!.status === 'published' || editArticle!.status === 'pending_review');
  const confirmLabel = !isEditing ? 'Publish' : isLiveEdit ? 'Save changes' : editArticle!.status === 'rejected' ? 'Resubmit' : 'Publish';

  return (
    <div className="bg-bg-card pb-[120px] pt-14">
      {step !== 'choose' && (
        <div className="mx-auto max-w-[760px]">
          <button
            type="button"
            onClick={() => {
              if (step === 'preview') {
                setStep(manual.body ? 'manual' : 'ai');
                return;
              }
              if (isEditing) {
                router.push(`/articles/${editArticle!.id}`);
                return;
              }
              setStep('choose');
            }}
            className="mb-5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
          >
            ← Back
          </button>
        </div>
      )}

      {step === 'choose' && (
        <div className="text-center">
          <div className="mx-auto max-w-[680px]">
            <Eyebrow className="justify-center">For Members</Eyebrow>
            <h2 className="mt-4 text-[clamp(28px,3.4vw,42px)] font-medium tracking-[-0.025em] text-ink">
              Share your expertise.
            </h2>
            <p className="mt-3 text-base leading-[1.6] text-ink-3">
              Publish an article and reach verified practitioners across 20+ countries. Choose how
              you&apos;d like to create it.
            </p>
          </div>
          <div className="mx-auto mt-11 grid max-w-[980px] animate-[anvIn_0.4s_cubic-bezier(0.22,1,0.36,1)_both] grid-cols-2 gap-6 text-left max-[720px]:grid-cols-1">
            <WriteOptionCard
              icon={UPLOAD_ICON}
              title="Write it yourself"
              description="Upload a file or paste your own text. Full control over your voice and structure."
              minutes={5}
              ctaLabel="Start writing"
              onClick={() => setStep('manual')}
            />
            <WriteOptionCard
              icon={AI_ICON}
              title="Let Expertly AI draft it"
              description="Answer a few quick questions and our AI writes a complete first draft for you to review."
              minutes={2}
              ctaLabel="Answer questions"
              badge="AI-Powered"
              dark
              onClick={() => setStep('ai')}
            />
          </div>
        </div>
      )}

      {step === 'manual' && (
        <div className="mx-auto max-w-[760px]">
          <ManualArticleForm
            practiceAreas={practiceAreas}
            value={manual}
            onChange={updateManual}
            onPreview={() => setStep('preview')}
            onSaveDraft={isLiveEdit ? undefined : saveDraft}
            savingDraft={savingDraft}
          />
        </div>
      )}

      {step === 'ai' && (
        <div className="mx-auto max-w-[760px]">
          <AiDraftWizard
            practiceAreas={practiceAreas}
            onDrafted={async (draft) => {
              const names = practiceAreas
                .filter((p) => draft.practiceAreaIds.includes(p.id))
                .map((p) => p.name);
              // Best-effort — an Unsplash hiccup shouldn't block moving on to the preview step;
              // the member can still pick an image manually from there if this comes back empty.
              const coverImageUrl = await getCoverImageSuggestions(names.join(' '))
                .then((res) => res.images[0] ?? '')
                .catch(() => '');
              setManual((prev) => ({
                ...prev,
                title: draft.title,
                // Already real, sanitized HTML — the backend's ai-draft/ai-refine endpoints run
                // the model's output through the same sanitize-html allowlist the save path uses
                // before returning it (see apps/backend/src/ai/ai.service.ts), so it loads
                // straight into the rich text editor as-is.
                body: draft.body,
                practiceAreaIds: draft.practiceAreaIds,
                countries: draft.countries,
                state: draft.state,
                coverImageUrl,
              }));
              setStep('preview');
            }}
          />
        </div>
      )}

      {step === 'preview' && (
        <div className="mx-auto max-w-[760px]">
          <ArticleLivePreview
            title={manual.title}
            body={manual.body}
            coverImageUrl={manual.coverImageUrl}
            practiceAreaName={practiceAreas.find((p) => p.id === manual.practiceAreaIds[0])?.name}
            countries={manual.countries}
            authorName={authorName}
            onBack={() => setStep(manual.body ? 'manual' : 'ai')}
            onConfirm={submitManual}
            confirmLabel={confirmLabel}
            confirming={submitting}
          />
        </div>
      )}

      {error && (
        <div className="mx-auto mt-4 max-w-[760px]">
          <ErrorBanner message={error} />
        </div>
      )}
    </div>
  );
}
