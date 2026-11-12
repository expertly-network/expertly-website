'use client';

import { useEffect, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { StepActions } from '@/components/apply/StepActions';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { scrollToFirstError } from '@/components/apply/scrollToError';
import { WorkHistoryFields } from '@/components/apply/WorkHistoryFields';
import { EducationFields } from '@/components/apply/EducationFields';
import { useFieldErrors } from '@/components/apply/useFieldErrors';
import { careerYears, sortWorkHistoryNewestFirst } from '@/lib/apply/work-history';
import { shareCompanyWebsites } from '@/lib/apply/company-websites';
import { backgroundErrors, groupByCompany, isCurrentCompany } from '@/lib/apply/background-errors';
import type { WizardFormState } from '@/components/apply/types';

export function BackgroundStep({
  form,
  update,
  saving,
  saveError,
  onBack,
  onNext,
  referencesRequired = true,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  saving?: boolean;
  saveError?: string | null;
  onBack: () => void;
  onNext: () => void;
  /** False during the founding-cohort pre-launch: references are optional (a card is still checked
   * once anything is typed into it). */
  referencesRequired?: boolean;
}) {
  const { errors, setErrors, clearErrors } = useFieldErrors();
  const workExperiences = shareCompanyWebsites(form.workExperiences);
  const companies = groupByCompany(workExperiences);

  // Newest-first on arrival (resumed drafts / LinkedIn imports); re-sorted again on Next.
  useEffect(() => {
    const sorted = sortWorkHistoryNewestFirst(form.workExperiences);
    if (sorted.some((w, i) => w !== form.workExperiences[i])) update({ workExperiences: sorted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Overall years, worked out from the roles (earliest start → today) when the applicant hasn't
  // given one — LinkedIn rarely supplies it. Keeps tracking the roles until they type their own.
  const calculatedYears = useMemo(() => careerYears(form.workExperiences), [form.workExperiences]);
  useEffect(() => {
    if (calculatedYears === null) return;
    const canFill = form.yearsOfExperience === '' || form.yearsOfExperienceCalculated;
    if (canFill && form.yearsOfExperience !== String(calculatedYears)) {
      update({ yearsOfExperience: String(calculatedYears), yearsOfExperienceCalculated: true });
      clearErrors(['yearsOfExperience']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatedYears]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = backgroundErrors(form);
    form.peerReferences.forEach((r, i) => {
      if (!referencesRequired && !r.name.trim() && !r.relationship.trim() && !r.email.trim()) return;
      if (!r.name.trim()) e[`peerReferences.${i}.name`] = 'Reference name is required.';
      else if (!r.relationship.trim()) e[`peerReferences.${i}.relationship`] = 'Relationship is required.';
      else if (!r.email.trim()) e[`peerReferences.${i}.email`] = 'Reference email is required.';
    });

    return e;
  }

  function handleNext() {
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      scrollToFirstError(fieldErrors);
      return;
    }
    setErrors({});
    // Persist newest-first (the backend also sorts; this keeps what the applicant sees in step).
    // A past company's size and website aren't asked for, so none is kept for it either.
    const pastCompanyRoles = new Set(
      companies.filter((c) => !isCurrentCompany(workExperiences, c.roles)).flatMap((c) => c.roles)
    );
    const cleaned = workExperiences.map((w, i) =>
      pastCompanyRoles.has(i) ? { ...w, firmSize: undefined, companyUrl: undefined } : w
    );
    update({ workExperiences: sortWorkHistoryNewestFirst(cleaned) });
    onNext();
  }

  function updateReference(index: number, patch: Partial<WizardFormState['peerReferences'][number]>) {
    const next = [...form.peerReferences];
    next[index] = { ...next[index], ...patch };
    update({ peerReferences: next });
    clearErrors(Object.keys(patch).map((key) => `peerReferences.${index}.${key}`));
  }

  return (
    <div>
      <h2 className="text-heading text-ink">Your background.</h2>
      <p className="mt-2 text-lede text-ink-3">Work history, qualifications, and overall seniority.</p>

      <WorkHistoryFields form={form} update={update} errors={errors} setErrors={setErrors} clearErrors={clearErrors} />

      <EducationFields form={form} update={update} errors={errors} clearErrors={clearErrors} />

      {/* Optional during the founding-cohort pre-launch (SITE_LAUNCHED=false). */}
      <div className="mt-8 flex items-baseline justify-between border-t border-line pt-6">
        <span className="text-mono-label text-ink-3">PEER REFERENCES</span>
        <span className="text-xs text-ink-3">
          {referencesRequired ? '2 required, as part of verification' : 'Optional'}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-ink-3">
        {referencesRequired
          ? 'Two professional peers we can contact to verify your background.'
          : 'Professional peers we can contact to verify your background. We’ve added one to start you off — edit or clear it as you like.'}
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {form.peerReferences.map((reference, i) => (
          <div key={i} className="rounded-2xl border border-line bg-bg-card p-6">
            <span className="text-mono-label text-ink-3">Reference {String(i + 1).padStart(2, '0')}</span>

            <div className="mt-3.5 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <Input
                id={`peerReferences.${i}.name`}
                label="Full name"
                markRequired={referencesRequired}
                value={reference.name}
                onChange={(e) => updateReference(i, { name: e.target.value })}
                error={errors[`peerReferences.${i}.name`]}
              />
              <Input
                id={`peerReferences.${i}.relationship`}
                label="Relationship"
                markRequired={referencesRequired}
                placeholder="e.g. Former manager"
                value={reference.relationship}
                onChange={(e) => updateReference(i, { relationship: e.target.value })}
                error={errors[`peerReferences.${i}.relationship`]}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <Input
                id={`peerReferences.${i}.email`}
                label="Email"
                markRequired={referencesRequired}
                type="email"
                value={reference.email}
                onChange={(e) => updateReference(i, { email: e.target.value })}
                error={errors[`peerReferences.${i}.email`]}
              />
              <Input
                label="Phone"
                labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                type="tel"
                value={reference.phone ?? ''}
                onChange={(e) => updateReference(i, { phone: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      {saveError && (
        <div className="mt-6">
          <ErrorBanner message={saveError} />
        </div>
      )}

      <StepActions
        onBack={onBack}
        onNext={handleNext}
        nextLabel={saving ? 'Saving…' : 'Next: Services'}
        nextDisabled={saving}
      />
    </div>
  );
}
