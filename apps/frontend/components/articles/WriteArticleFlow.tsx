'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { Eyebrow } from '@/components/ui';
import { WriteOptionCard } from '@/components/articles/WriteOptionCard';
import {
  ManualArticleForm,
  EMPTY_MANUAL_ARTICLE_FORM,
  type ManualArticleFormState,
} from '@/components/articles/ManualArticleForm';
import { AiDraftWizard } from '@/components/articles/AiDraftWizard';
import { ArticleLivePreview } from '@/components/articles/ArticleLivePreview';
import { WriteSuccess } from '@/components/articles/WriteSuccess';
import { createArticle, updateArticle, getCoverImageSuggestions } from '@/lib/api/articles';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import { useUnsavedChangesGuard } from '@/lib/hooks/useUnsavedChangesGuard';
import type { CategoryDto } from '@shared/category';
import type { ArticleDto } from '@shared/article';

type Step = 'choose' | 'manual' | 'ai' | 'preview' | 'success';

function toManualFormState(article: ArticleDto): ManualArticleFormState {
  return {
    title: article.title,
    serviceIds: article.services.map((s) => s.id),
    customServiceLabels: article.customServiceLabels,
    countries: article.countries,
    state: article.state ?? '',
    body: article.body,
    coverImageUrl: article.coverImageUrl,
  };
}

const UPLOAD_ICON = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <path d="M12 18v-6M9.5 14.5L12 12l2.5 2.5" />
  </svg>
);
const AI_ICON = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

// Choose a path, fill out that path's form, preview, then confirm.
export function WriteArticleFlow({
  categories,
  authorName,
  editArticle,
}: {
  categories: CategoryDto[];
  authorName: string;
  editArticle?: ArticleDto | null;
}) {
  const services = categories.flatMap((c) => c.services);
  const router = useRouter();
  const isEditing = Boolean(editArticle);
  const [step, setStep] = useState<Step>(editArticle ? 'manual' : 'choose');
  const [initialManual] = useState<ManualArticleFormState>(() =>
    editArticle ? toManualFormState(editArticle) : EMPTY_MANUAL_ARTICLE_FORM
  );
  const [manual, setManual] = useState<ManualArticleFormState>(initialManual);
  // Set right before a successful save/submit navigates away, so the guard doesn't fire on it.
  const [saved, setSaved] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArticleDto | null>(null);
  // Set once the member takes the AI path to the preview step. A new article saved from here is
  // created as creationMode 'ai', linked to the generation it came from (admins can then see the
  // inputs it was generated from).
  const [usedAi, setUsedAi] = useState(false);
  const [aiGenerationId, setAiGenerationId] = useState<string | null>(null);
  const creationFields = usedAi
    ? { creationMode: 'ai' as const, ...(aiGenerationId ? { aiGenerationId } : {}) }
    : { creationMode: 'manual' as const };

  // coverImageUrl is excluded: the form fills it in asynchronously on mount, which isn't an edit.
  const dirty = useMemo(() => {
    const strip = ({ coverImageUrl: _c, ...rest }: ManualArticleFormState) => JSON.stringify(rest);
    return !saved && strip(manual) !== strip(initialManual);
  }, [manual, initialManual, saved]);
  const { confirmLeave } = useUnsavedChangesGuard(dirty);

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
        serviceIds: manual.serviceIds,
        customServiceLabels: manual.customServiceLabels,
        countries: manual.countries,
        state: manual.state || undefined,
        status: 'draft' as const,
      };
      if (editArticle) {
        await updateArticle(editArticle.id, payload);
        setSaved(true);
        router.push(`/articles/${editArticle.slug}`);
      } else {
        await createArticle({ ...payload, ...creationFields });
        setSaved(true);
        // Lands on My Articles (where the draft now is) with a confirmation, not on Browse.
        router.push('/articles?tab=mine&saved=draft');
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save draft.'));
    } finally {
      setSavingDraft(false);
    }
  }

  // Omits status when editing an already-live article, so the PATCH is a pure content edit.
  async function submitManual() {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        title: manual.title,
        body: manual.body,
        coverImageUrl: manual.coverImageUrl,
        serviceIds: manual.serviceIds,
        customServiceLabels: manual.customServiceLabels,
        countries: manual.countries,
        state: manual.state || undefined,
      };
      if (editArticle) {
        const isLive = editArticle.status === 'published' || editArticle.status === 'pending_review';
        const article = await updateArticle(editArticle.id, isLive ? payload : { ...payload, status: 'published' });
        setSaved(true);
        router.push(`/articles/${article.slug}`);
      } else {
        const article = await createArticle({ ...payload, ...creationFields });
        setSaved(true);
        setResult(article);
        setStep('success');
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to save changes.'));
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'success' && result) {
    return <WriteSuccess status={result.status} articleSlug={result.slug} />;
  }

  const editStatus = editArticle?.status;
  const isLiveEdit = editStatus === 'published' || editStatus === 'pending_review';
  const confirmLabel = isLiveEdit ? 'Save changes' : editStatus === 'rejected' ? 'Resubmit' : 'Publish';

  return (
    <div className="bg-bg-card pb-[120px] pt-8">
      <div className={`mx-auto ${step === 'choose' ? 'max-w-[980px]' : 'max-w-[760px]'}`}>
        <button
          type="button"
          onClick={() => {
            if (step === 'preview') {
              setStep(manual.body ? 'manual' : 'ai');
              return;
            }
            if (editArticle) {
              if (confirmLeave()) router.push(`/articles/${editArticle.slug}`);
              return;
            }
            if (step === 'choose') {
              router.push('/articles');
              return;
            }
            setStep('choose');
          }}
          className="mb-5 text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
        >
          {step === 'choose' ? '← Back to articles' : isEditing && step === 'manual' ? '← Back to article' : '← Back'}
        </button>
      </div>

      {step === 'choose' && (
        <div className="text-center">
          <div className="mx-auto max-w-[680px]">
            <Eyebrow className="justify-center">For Members</Eyebrow>
            <h2 className="mt-4 text-[clamp(28px,3.4vw,42px)] font-medium tracking-[-0.025em] text-ink">
              Share your expertise.
            </h2>
            <p className="mt-3 text-base leading-[1.6] text-ink-3">
              Publish an article and reach verified practitioners across 20+ countries. Choose how you&apos;d like to
              create it.
            </p>
          </div>
          <div className="mx-auto mt-11 grid max-w-[980px] animate-[anvIn_0.4s_cubic-bezier(0.22,1,0.36,1)_both] grid-cols-2 gap-6 text-left max-[720px]:grid-cols-1">
            <WriteOptionCard
              icon={UPLOAD_ICON}
              title="Write it yourself"
              description="Write or paste your own text, with headings, lists and links. Full control over your voice and structure."
              minutes={5}
              ctaLabel="Start writing"
              onClick={() => setStep('manual')}
            />
            <WriteOptionCard
              icon={AI_ICON}
              title="Let GrowXQ AI draft it"
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
            categories={categories}
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
            categories={categories}
            onDrafted={async (draft) => {
              const names = services.filter((s) => draft.serviceIds.includes(s.id)).map((s) => s.name);
              // The real title makes this query specific to the article, not just its practice
              // area — the member can still swap it for another suggestion at the preview step.
              const query = [names.join(' '), draft.title].filter(Boolean).join(' ');
              // Best-effort; falls back to no image if the search fails.
              const coverImageUrl = await getCoverImageSuggestions(query)
                .then((res) => res.images[0] ?? '')
                .catch(() => '');
              setManual((prev) => ({
                ...prev,
                title: draft.title,
                body: draft.body,
                serviceIds: draft.serviceIds,
                countries: draft.countries,
                state: draft.state,
                coverImageUrl,
              }));
              setUsedAi(true);
              setAiGenerationId(draft.generationId);
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
            onCoverImageChange={(coverImageUrl) => updateManual({ coverImageUrl })}
            serviceName={services.find((s) => s.id === manual.serviceIds[0])?.name}
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
