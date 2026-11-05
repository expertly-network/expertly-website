'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WizardSidebar, WIZARD_STEPS } from '@/components/apply/WizardSidebar';
import { LogoImage } from '@/components/Logo';
import { WizardProgress } from '@/components/apply/WizardProgress';
import { LinkedInImportStep } from '@/components/apply/steps/LinkedInImportStep';
import { IdentityStep } from '@/components/apply/steps/IdentityStep';
import { BackgroundStep } from '@/components/apply/steps/BackgroundStep';
import { ServicesRatesStep } from '@/components/apply/steps/ServicesRatesStep';
import { ReviewSubmitStep } from '@/components/apply/steps/ReviewSubmitStep';
import { INITIAL_WIZARD_STATE, fromDto, toUpdateRequest, type WizardFormState } from '@/components/apply/types';
import { importLinkedInPhoto, saveApplication } from '@/lib/api/applications';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import { validationFieldsMessage } from '@/lib/apply/save-errors';
import { FOUNDING_DEFAULT_REFERENCE } from '@/lib/launch';
import { ApiError } from '@/lib/api/client';
import { hasLinkedInIdentity } from '@/lib/auth/linkedin';
import type { CategoryDto } from '@shared/category';
import type { ApplicationDto } from '@shared/membership-application';

const TOTAL_STEPS = 5;

// Initial state for a resumed draft (or a fresh application when there's none). The account's own
// login email is the default contact email — it applies equally to an applicant who signed up with
// email/password and one who came through LinkedIn.
// The backend's validation messages name raw fields ("peerReferences.0.email must be an email") —
// never shown as-is; validationFieldsMessage turns them into readable field names, and these are
// the fallback when it can't. Each step validates its own fields before Next, so they only surface
// for something left unfinished on another step.
const SAVE_ERROR_COPY = {
  VALIDATION_FAILED: 'Some details look incomplete or invalid. Please check each step and try again.',
  APPLICATION_INCOMPLETE: 'A few required details are still missing. Please check each step, then submit again.',
};

function initialForm(
  application: ApplicationDto | null,
  accountEmail: string,
  referencesRequired: boolean
): WizardFormState {
  const form: WizardFormState = {
    ...INITIAL_WIZARD_STATE,
    ...(application ? fromDto(application) : {}),
    importedFields: new Set<string>(),
  };
  if (!form.contactEmail && accountEmail) form.contactEmail = accountEmail;
  // Pre-launch, Reference 1 starts as the founder (optional, editable) until the applicant has
  // been past the references (step 3). Not only for a brand-new application: connecting LinkedIn on
  // step 1 (and the photo import on mount) creates the draft and reloads /apply, so nearly every
  // applicant arrives at step 3 with a draft that has no references yet. Once they've moved on
  // from step 3, whatever they saved there — including clearing it — is kept.
  const beforeReferences = !application || (application.peerReferences.length === 0 && application.currentStep < 4);
  if (!referencesRequired && beforeReferences) {
    form.peerReferences = [{ ...FOUNDING_DEFAULT_REFERENCE }, form.peerReferences[1]];
  }
  return form;
}

/**
 * `initialApplication` is the caller's draft, fetched by the server page (which already redirects
 * every non-draft status), or null to start a new one. `categories` feed steps 4 and 5.
 */
export function ApplicationWizard({
  initialApplication,
  accountEmail,
  categories,
  suggestedCoupon = null,
  referencesRequired = true,
  previewMode = false,
}: {
  initialApplication: ApplicationDto | null;
  accountEmail: string;
  categories: CategoryDto[];
  /** A code to offer at review (an invite link's, or the founding one) — offered, never auto-applied. */
  suggestedCoupon?: string | null;
  /** False during the founding-cohort pre-launch (SITE_LAUNCHED=false): references are optional. */
  referencesRequired?: boolean;
  /** Local design preview only; disables all persistence and external imports. */
  previewMode?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialApplication?.currentStep || 1);
  const [form, setForm] = useState<WizardFormState>(() =>
    initialForm(initialApplication, accountEmail, referencesRequired)
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fills in a photo from the applicant's linked LinkedIn identity once one is confirmed — run
  // here, not inside LinkedInImportStep, because connecting LinkedIn does a full page redirect
  // away and back to /apply. That redirect can land the wizard back on ANY step (goBack()/the
  // sidebar's "revisit a completed step" navigation is client-side only and never persists
  // currentStep), so step 1 may not even render on return. Running it on mount makes it run
  // regardless of which step shows.
  //
  // Deliberately does NOT touch linkedinImportConsent — connecting LinkedIn verifies identity
  // (and, via LinkedIn's own OAuth consent screen, already covers sharing name/email/photo with
  // us); it is a separate thing from the applicant's consent to having GrowXQ extract and
  // publish their bio/work-history/education, which stays a real opt-in checkbox in
  // LinkedInImportStep, set only when they actually choose to run that import.
  useEffect(() => {
    if (previewMode || form.photoUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const linked = await hasLinkedInIdentity();
        if (cancelled || !linked) return;
        const withPhoto = await importLinkedInPhoto();
        if (cancelled) return;
        // Tagged as imported so the LinkedIn profile import can later swap this low-res OAuth
        // picture for the scrape's full-size photo — a manual upload clears the tag.
        // Only the photo is taken from the response. Merging the whole draft (as this used to) wiped
        // what initialForm had pre-filled for a brand-new applicant, since that draft is still
        // empty: the account email in Contact email, and the founder as Reference 1.
        setForm((prev) =>
          prev.photoUrl || !withPhoto.photoUrl
            ? prev
            : {
                ...prev,
                photoUrl: withPhoto.photoUrl,
                importedFields: new Set(prev.importedFields).add('photoUrl'),
              }
        );
      } catch {
        // Best-effort convenience only: the photo field stays empty and the applicant uploads one
        // in step 2 (where the photo is required), so there's nothing to block on or report here.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount (see above)
  }, []);

  function update(patch: Partial<WizardFormState>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      // A field edited here stops counting as imported.
      const importedFields = new Set(prev.importedFields);
      for (const key of Object.keys(patch)) importedFields.delete(key);
      next.importedFields = importedFields;
      return next;
    });
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Lets callers that advance immediately after update() pass the pending patch explicitly.
  async function handleAdvance(targetStep: number, overrides?: Partial<WizardFormState>) {
    if (previewMode) {
      if (overrides) update(overrides);
      setStep(targetStep);
      scrollTop();
      return;
    }
    setSaving(true);
    setSaveError(null);
    const effectiveForm = overrides ? { ...form, ...overrides } : form;
    try {
      const updated = await saveApplication(toUpdateRequest(effectiveForm, { currentStep: targetStep }));
      setForm((prev) => ({ ...prev, ...overrides, ...fromDto(updated) }));
      setStep(targetStep);
      scrollTop();
    } catch (err) {
      setSaveError(
        validationFieldsMessage(err) ?? apiErrorMessage(err, 'Failed to save — please try again.', SAVE_ERROR_COPY)
      );
    } finally {
      setSaving(false);
    }
  }

  function goBack(targetStep: number) {
    setStep(targetStep);
    scrollTop();
  }

  // `couponCode` is what the review step actually applied ('' for none) — sent explicitly, since
  // toUpdateRequest drops an empty code and the draft may still hold an older, unapplied one.
  async function handleSubmit({ couponCode }: { couponCode: string }) {
    if (previewMode) {
      setSaveError('Design preview only — no application is submitted.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await saveApplication({ ...toUpdateRequest(form, { status: 'submitted' }), couponCode });
      router.push('/apply/submitted');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'APPLICATION_LOCKED') {
        setSaveError('You already have an application in progress.');
      } else {
        setSaveError(
          validationFieldsMessage(err) ??
            apiErrorMessage(err, 'Something went wrong submitting your application. Please try again.', SAVE_ERROR_COPY)
        );
      }
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-bg-alt">
      <header className="hidden border-b border-line bg-bg-card max-[900px]:block">
        <div className="mx-auto flex min-h-20 max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8">
          <LogoImage surface="light" height={28} priority />
          <span className="text-caption text-ink-3">
            {previewMode ? 'Local design preview' : 'Membership application'}
          </span>
        </div>
      </header>
      <div className="grid min-h-screen grid-cols-[360px_minmax(0,1fr)] max-[900px]:min-h-0 max-[900px]:grid-cols-1">
        <div className="max-[900px]:hidden">
          <WizardSidebar currentStep={step} onStepClick={goBack} saving={saving} previewMode={previewMode} />
        </div>
        <div className="mx-auto w-full min-w-0 max-w-[1300px] px-[60px] pb-14 pt-24 max-[900px]:px-5 max-[900px]:pb-[calc(112px+env(safe-area-inset-bottom))] max-[900px]:pt-6">
          <div>
            <div className="max-[900px]:hidden">
              <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} saving={saving} />
            </div>
            <div className="mb-7 hidden max-[900px]:block">
              <div className="flex items-center justify-between gap-4">
                <span className="text-label uppercase tracking-[0.12em] text-ink-3">
                  Step {step} of {TOTAL_STEPS}
                </span>
                <span role="status" className="text-caption text-ink-3">
                  {saving ? 'Saving…' : ''}
                </span>
              </div>
              <p className="mt-3 text-base font-medium text-ink">{WIZARD_STEPS[step - 1].label}</p>
              <nav aria-label="Application steps" className="isolate mt-6 grid grid-cols-5">
                {WIZARD_STEPS.map(({ num, label }) => {
                  const active = num === step;
                  const done = num < step;
                  return (
                    <button
                      key={num}
                      type="button"
                      aria-label={`Step ${num}: ${label}${done ? ', completed' : ''}`}
                      aria-current={active ? 'step' : undefined}
                      disabled={saving || (!previewMode && num > step)}
                      onClick={() => goBack(num)}
                      className={`relative flex min-h-[104px] min-w-0 flex-col items-center gap-4 rounded-lg px-1 pb-3 pt-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default ${active ? 'text-ink' : done ? 'text-accent-2' : 'text-ink-3'}`}
                    >
                      {num < TOTAL_STEPS && (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute left-1/2 top-7 -z-10 h-px w-full ${done ? 'bg-accent' : 'bg-line-2'}`}
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs ${active ? 'border-2 border-accent bg-bg-alt font-semibold text-accent-2 shadow-[0_0_0_5px_var(--neon)]' : done ? 'border border-accent bg-accent text-white' : 'border border-line-2 bg-bg-alt text-ink-3'}`}
                      >
                        {done ? '✓' : num}
                      </span>
                      <span
                        className={`flex h-8 max-w-[9ch] items-center justify-center text-center text-[11px] leading-4 text-balance ${active ? 'font-semibold' : 'font-medium'}`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
            <fieldset
              disabled={previewMode}
              className="min-w-0 rounded-2xl border border-line-2 bg-bg-card p-12 shadow-[0_8px_36px_rgba(11,11,12,0.02)] max-[900px]:border-line max-[900px]:rounded-xl max-[900px]:p-6 max-[380px]:p-4"
            >
              <legend className="sr-only">{WIZARD_STEPS[step - 1].label}</legend>
              {step === 1 && (
                <LinkedInImportStep
                  form={form}
                  update={update}
                  saving={saving}
                  saveError={saveError}
                  onNext={(overrides) => handleAdvance(2, overrides)}
                />
              )}
              {step === 2 && (
                <IdentityStep
                  form={form}
                  update={update}
                  saving={saving}
                  saveError={saveError}
                  onBack={() => goBack(1)}
                  onNext={() => handleAdvance(3)}
                />
              )}
              {step === 3 && (
                <BackgroundStep
                  form={form}
                  update={update}
                  saving={saving}
                  saveError={saveError}
                  onBack={() => goBack(2)}
                  onNext={() => handleAdvance(4)}
                  referencesRequired={referencesRequired}
                />
              )}
              {step === 4 && (
                <ServicesRatesStep
                  form={form}
                  update={update}
                  categories={categories}
                  saving={saving}
                  saveError={saveError}
                  onBack={() => goBack(3)}
                  onNext={() => handleAdvance(5)}
                />
              )}
              {step === 5 && (
                <ReviewSubmitStep
                  form={form}
                  update={update}
                  categories={categories}
                  saving={saving}
                  saveError={saveError}
                  onBack={() => goBack(4)}
                  onEditStep={goBack}
                  suggestedCoupon={suggestedCoupon}
                  onSubmit={handleSubmit}
                />
              )}
            </fieldset>
          </div>
        </div>
      </div>
    </div>
  );
}
