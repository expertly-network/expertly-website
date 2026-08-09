'use client';

import { useEffect, useState } from 'react';
import { WizardSidebar } from '@/components/apply/WizardSidebar';
import { WizardProgress } from '@/components/apply/WizardProgress';
import { LinkedInImportStep } from '@/components/apply/steps/LinkedInImportStep';
import { IdentityStep } from '@/components/apply/steps/IdentityStep';
import { BackgroundStep } from '@/components/apply/steps/BackgroundStep';
import { ServicesRatesStep } from '@/components/apply/steps/ServicesRatesStep';
import { ReviewSubmitStep } from '@/components/apply/steps/ReviewSubmitStep';
import { INITIAL_WIZARD_STATE, type WizardFormState } from '@/components/apply/types';
import { getPracticeAreas } from '@/lib/api/practice-areas';
import type { PracticeAreaDto } from '@shared/practice-area';

const TOTAL_STEPS = 5;

export function ApplicationWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<WizardFormState>(INITIAL_WIZARD_STATE);
  const [practiceAreas, setPracticeAreas] = useState<PracticeAreaDto[]>([]);

  // Fetched once here (not per-step) so navigating back and forth through
  // the wizard doesn't re-fetch — only Step 4 (selection) and Step 5
  // (name resolution for review) need this.
  useEffect(() => {
    getPracticeAreas()
      .then(setPracticeAreas)
      .catch(() => setPracticeAreas([]));
  }, []);

  function update(patch: Partial<WizardFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function goTo(target: number) {
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="grid grid-cols-[300px_1fr] overflow-hidden rounded-3xl border border-line bg-bg-card max-[900px]:grid-cols-1">
      <WizardSidebar currentStep={step} onStepClick={goTo} />

      <div className="px-10 py-12 max-[900px]:px-5 max-[900px]:py-8">
        <WizardProgress currentStep={step} totalSteps={TOTAL_STEPS} />

        {step === 1 && (
          <LinkedInImportStep form={form} update={update} onNext={() => goTo(2)} />
        )}
        {step === 2 && (
          <IdentityStep form={form} update={update} onBack={() => goTo(1)} onNext={() => goTo(3)} />
        )}
        {step === 3 && (
          <BackgroundStep form={form} update={update} onBack={() => goTo(2)} onNext={() => goTo(4)} />
        )}
        {step === 4 && (
          <ServicesRatesStep
            form={form}
            update={update}
            practiceAreas={practiceAreas}
            onBack={() => goTo(3)}
            onNext={() => goTo(5)}
          />
        )}
        {step === 5 && (
          <ReviewSubmitStep
            form={form}
            update={update}
            practiceAreas={practiceAreas}
            onBack={() => goTo(4)}
          />
        )}
      </div>
    </div>
  );
}
