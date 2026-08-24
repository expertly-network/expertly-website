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
import { getPracticeAreas } from '@/lib/api/practice-areas';
import { getMyApplication, saveApplication } from '@/lib/api/applications';
import { ApiError } from '@/lib/api/client';
import type { PracticeAreaDto } from '@shared/practice-area';

const TOTAL_STEPS = 5;

export function ApplicationWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(INITIAL_WIZARD_STATE);
  const [practiceAreas, setPracticeAreas] = useState<PracticeAreaDto[]>([]);
  const [resuming, setResuming] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetched once here (not per-step) so navigating back and forth through
  // the wizard doesn't re-fetch — only Step 4 (selection) and Step 5
  // (name resolution for review) need this.
  useEffect(() => {
    getPracticeAreas()
      .then(setPracticeAreas)
      .catch(() => setPracticeAreas([]));
  }, []);

  // Resume an in-progress draft. A non-draft application (already submitted/decided) means this
  // applicant has no business seeing an empty wizard — redirect to the status page instead.
  useEffect(() => {
    let cancelled = false;
    getMyApplication()
      .then((app) => {
        if (cancelled || !app) return;
        if (app.status !== 'draft') {
          router.replace('/apply/submitted');
          return;
        }
        setForm((prev) => ({ ...prev, ...fromDto(app), importedFields: new Set() }));
        setStep(app.currentStep || 1);
      })
      .finally(() => {
        if (!cancelled) setResuming(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(patch: Partial<WizardFormState>) {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      // Any field this call actually changes stops counting as "imported" — an edited value is
      // the applicant's own now, regardless of where it started.
      const importedFields = new Set(prev.importedFields);
      for (const key of Object.keys(patch)) importedFields.delete(key);
      next.importedFields = importedFields;
      return next;
    });
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // `overrides` exists for callers (LinkedInImportStep) that call update() and then immediately
  // advance in the same handler — setState from update() hasn't been applied to `form` yet at
  // that point (React batches it for the next render), so without this, the save request would
  // go out with the pre-import `form` and silently drop whatever was just imported. Passing the
  // same patch as `overrides` here guarantees the save sees it regardless of render timing.
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

  // Full-bleed two-column layout matching design/static_html/apply.html's actual CSS
  // (.apply-grid: grid-template-columns: 360px 1fr; min-height: 100vh — a real split-screen
  // filling the viewport, not a boxed card centered in a narrow column). The step content itself
  // gets the card treatment (.apply-form: border + shadow + rounded-2xl), not the whole page.
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
              practiceAreas={practiceAreas}
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
              practiceAreas={practiceAreas}
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
