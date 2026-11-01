'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WizardSidebar } from '@/components/apply/WizardSidebar';
import { WizardProgress } from '@/components/apply/WizardProgress';
import { LinkedInImportStep } from '@/components/apply/steps/LinkedInImportStep';
import { IdentityStep } from '@/components/apply/steps/IdentityStep';
import { BackgroundStep } from '@/components/apply/steps/BackgroundStep';
import { ServicesRatesStep } from '@/components/apply/steps/ServicesRatesStep';
import { ReviewSubmitStep } from '@/components/apply/steps/ReviewSubmitStep';
import { INITIAL_WIZARD_STATE, fromDto, toUpdateRequest, type WizardFormState } from '@/components/apply/types';
import { importLinkedInPhoto, saveApplication } from '@/lib/api/applications';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import { ApiError } from '@/lib/api/client';
import { hasLinkedInIdentity } from '@/lib/auth/linkedin';
import type { CategoryDto } from '@shared/category';
import type { ApplicationDto } from '@shared/membership-application';

const TOTAL_STEPS = 5;

// Initial state for a resumed draft (or a fresh application when there's none). The account's own
// login email is the default contact email — it applies equally to an applicant who signed up with
// email/password and one who came through LinkedIn.
// The backend's validation messages name raw fields ("peerReferences.0.email must be an email") —
// never shown to an applicant. Each step validates its own fields before Next, so these only
// surface for something left unfinished on another step.
const SAVE_ERROR_COPY = {
  VALIDATION_FAILED: 'Some details look incomplete or invalid. Please check each step and try again.',
  APPLICATION_INCOMPLETE: 'A few required details are still missing. Please check each step, then submit again.',
};

function initialForm(
  application: ApplicationDto | null,
  accountEmail: string,
  linkCoupon: string | null
): WizardFormState {
  const form: WizardFormState = {
    ...INITIAL_WIZARD_STATE,
    ...(application ? fromDto(application) : {}),
    importedFields: new Set<string>(),
  };
  if (!form.contactEmail && accountEmail) form.contactEmail = accountEmail;
  // A code the applicant already typed wins; otherwise the one their invite link carried.
  if (!form.couponCode && linkCoupon) form.couponCode = linkCoupon;
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
  linkCoupon = null,
  collectReferences = true,
}: {
  initialApplication: ApplicationDto | null;
  accountEmail: string;
  categories: CategoryDto[];
  /** From a `?coupon=` link, remembered across sign-up — pre-filled and auto-applied at review. */
  linkCoupon?: string | null;
  /** False during the founding-cohort pre-launch (SITE_LAUNCHED=false): no peer references step. */
  collectReferences?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialApplication?.currentStep || 1);
  const [form, setForm] = useState<WizardFormState>(() => initialForm(initialApplication, accountEmail, linkCoupon));
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
    if (form.photoUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const linked = await hasLinkedInIdentity();
        if (cancelled || !linked) return;
        const withPhoto = await importLinkedInPhoto();
        if (cancelled) return;
        // Tagged as imported so the LinkedIn profile import can later swap this low-res OAuth
        // picture for the scrape's full-size photo — a manual upload clears the tag.
        setForm((prev) =>
          prev.photoUrl
            ? prev
            : { ...prev, ...fromDto(withPhoto), importedFields: new Set(prev.importedFields).add('photoUrl') }
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
    setSaving(true);
    setSaveError(null);
    const effectiveForm = overrides ? { ...form, ...overrides } : form;
    try {
      const updated = await saveApplication(toUpdateRequest(effectiveForm, { currentStep: targetStep }));
      setForm((prev) => ({ ...prev, ...overrides, ...fromDto(updated) }));
      setStep(targetStep);
      scrollTop();
    } catch (err) {
      setSaveError(apiErrorMessage(err, 'Failed to save — please try again.', SAVE_ERROR_COPY));
    } finally {
      setSaving(false);
    }
  }

  function goBack(targetStep: number) {
    setStep(targetStep);
    scrollTop();
  }

  async function handleSubmit() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveApplication(toUpdateRequest(form, { status: 'submitted' }));
      router.push('/apply/submitted');
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'APPLICATION_LOCKED') {
        setSaveError('You already have an application in progress.');
      } else {
        setSaveError(
          apiErrorMessage(err, 'Something went wrong submitting your application. Please try again.', SAVE_ERROR_COPY)
        );
      }
      setSaving(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-[360px_1fr] bg-bg-alt max-[900px]:grid-cols-1">
      <WizardSidebar currentStep={step} onStepClick={goBack} />

      <div className="mx-auto w-full max-w-[1300px] px-[60px] pb-14 pt-24 max-[900px]:px-6 max-[900px]:pb-10 max-[900px]:pt-24">
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} saving={saving} />

        <div className="rounded-2xl border border-line-2 bg-bg-card p-12 shadow-[0_8px_36px_rgba(11,11,12,0.02)] max-[640px]:p-6">
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
              collectReferences={collectReferences}
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
              onSubmit={handleSubmit}
              collectReferences={collectReferences}
            />
          )}
        </div>
      </div>
    </div>
  );
}
