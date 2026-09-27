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
import { getCategories } from '@/lib/api/categories';
import { getMyApplication, importLinkedInPhoto, saveApplication } from '@/lib/api/applications';
import { ApiError } from '@/lib/api/client';
import { hasLinkedInIdentity } from '@/lib/auth/linkedin';
import { createClient } from '@/lib/supabase/client';
import type { CategoryDto } from '@shared/category';

const TOTAL_STEPS = 5;

export function ApplicationWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(INITIAL_WIZARD_STATE);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [resuming, setResuming] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetched once; steps 4 and 5 are the only consumers.
  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Redirects to the status page if the application is already submitted/decided.
  useEffect(() => {
    let cancelled = false;
    // The account's own login email is a sensible, always-available default for contact email —
    // fetched alongside the draft rather than gated behind LinkedIn, since it applies equally to
    // an applicant who signed up with email/password. getSession() (not getUser()) deliberately —
    // this is a UI convenience default, not an authorization decision, so it should stay a cheap
    // local cookie read (per docs/auth.md's own distinction) instead of adding a real network
    // round-trip to every /apply load — getUser() here previously left the page stuck on its
    // loading skeleton until that round-trip finished.
    Promise.all([getMyApplication(), createClient().auth.getSession()])
      .then(([app, { data }]) => {
        if (cancelled) return;
        if (app && app.status !== 'draft') {
          router.replace('/apply/submitted');
          return;
        }
        setForm((prev) => {
          const next: WizardFormState = { ...prev, ...(app ? fromDto(app) : {}), importedFields: new Set<string>() };
          if (!next.contactEmail && data.session?.user.email) next.contactEmail = data.session.user.email;
          return next;
        });
        if (app) setStep(app.currentStep || 1);
      })
      .finally(() => {
        if (!cancelled) setResuming(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fills in a photo from the applicant's linked LinkedIn identity once one is confirmed — run
  // here, not inside LinkedInImportStep, because connecting LinkedIn does a full page redirect
  // away and back to /apply. That redirect can land the wizard back on ANY step (goBack()/the
  // sidebar's "revisit a completed step" navigation is client-side only and never persists
  // currentStep), so step 1 may not even render on return. Keying this off "resuming just
  // finished" instead of "step 1 is showing" makes it run regardless.
  //
  // Deliberately does NOT touch linkedinImportConsent — connecting LinkedIn verifies identity
  // (and, via LinkedIn's own OAuth consent screen, already covers sharing name/email/photo with
  // us); it is a separate thing from the applicant's consent to having Expertly extract and
  // publish their bio/work-history/education, which stays a real opt-in checkbox in
  // LinkedInImportStep, set only when they actually choose to run that import.
  useEffect(() => {
    if (resuming || form.photoUrl) return;
    let cancelled = false;
    (async () => {
      const linked = await hasLinkedInIdentity();
      if (cancelled || !linked) return;
      importLinkedInPhoto()
        .then((withPhoto) => {
          if (!cancelled) setForm((prev) => (prev.photoUrl ? prev : { ...prev, ...fromDto(withPhoto) }));
        })
        .catch(() => {});
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resuming]);

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
      setSaveError(err instanceof ApiError ? err.message : 'Failed to save — please try again.');
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
      if (err instanceof ApiError && err.statusCode === 409) {
        setSaveError('You already have an application in progress.');
      } else if (err instanceof ApiError) {
        setSaveError(err.message);
      } else {
        setSaveError('Something went wrong submitting your application. Please try again.');
      }
      setSaving(false);
    }
  }

  if (resuming) {
    return (
      <div className="grid min-h-screen grid-cols-[360px_1fr] bg-bg-alt max-[900px]:grid-cols-1">
        <WizardSidebar currentStep={1} onStepClick={() => {}} />
        <div className="mx-auto w-full max-w-[1300px] px-[60px] pb-14 pt-24 max-[900px]:px-6 max-[900px]:pb-10 max-[900px]:pt-24">
          <div className="mb-10 h-[3px] w-full animate-pulse rounded-full bg-line" />
          <div className="rounded-2xl border border-line-2 bg-bg-card p-12 shadow-[0_8px_36px_rgba(11,11,12,0.02)] max-[640px]:p-6">
            <div className="flex flex-col gap-5">
              <div className="h-7 w-2/5 animate-pulse rounded-md bg-bg-alt" />
              <div className="h-4 w-4/5 animate-pulse rounded-md bg-bg-alt" />
              <div className="mt-4 h-32 animate-pulse rounded-2xl bg-bg-alt" />
              <div className="h-14 animate-pulse rounded-input bg-bg-alt" />
              <div className="h-14 animate-pulse rounded-input bg-bg-alt" />
            </div>
          </div>
        </div>
      </div>
    );
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
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
}
