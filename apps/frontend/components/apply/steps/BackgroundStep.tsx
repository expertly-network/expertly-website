'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { WarningNote } from '@/components/ui/WarningNote';
import { FIELD_FOCUS, FIELD_FOCUS_ERROR } from '@/components/ui/field-styles';
import { StepActions } from '@/components/apply/StepActions';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ImportedTag } from '@/components/apply/ImportedTag';
import { scrollToFirstError } from '@/components/apply/scrollToError';
import { careerYears, findOverlaps, isEndBeforeStart, sortWorkHistoryNewestFirst } from '@/lib/apply/work-history';
import { Badge } from '@/components/ui/Badge';
import {
  EMPTY_EDUCATION,
  EMPTY_WORK_EXPERIENCE,
  FIRM_SIZES,
  MONTHS,
  type WizardFormState,
} from '@/components/apply/types';

// Mirrors WORK_EXPERIENCES_MAX / EDUCATIONS_MAX in the backend's update-application.dto.ts.
const WORK_EXPERIENCES_MAX = 15;
const EDUCATIONS_MAX = 5;

const YEARS = Array.from({ length: 67 }, (_, i) => new Date().getFullYear() - i);

export function BackgroundStep({
  form,
  update,
  saving,
  saveError,
  onBack,
  onNext,
  collectReferences = true,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  saving?: boolean;
  saveError?: string | null;
  onBack: () => void;
  onNext: () => void;
  /** False during the founding-cohort pre-launch: the peer references section is hidden. */
  collectReferences?: boolean;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  // Live date problems per card. End-before-start blocks Next; an overlap with another role is
  // only a warning — concurrent roles (e.g. sub-roles at one firm) are legitimate.
  const dateErrors = useMemo(
    () =>
      form.workExperiences.map((w): string | undefined =>
        isEndBeforeStart(w) ? 'End date is before the start date.' : undefined
      ),
    [form.workExperiences]
  );
  const dateWarnings = useMemo(() => {
    const overlaps = findOverlaps(form.workExperiences);
    return form.workExperiences.map((w, i): string | undefined => {
      if (overlaps[i] === -1 || isEndBeforeStart(w)) return undefined;
      const other = form.workExperiences[overlaps[i]];
      const name = [other.title, other.company].filter((x) => x.trim()).join(' at ') || `Experience ${overlaps[i] + 1}`;
      return `These dates overlap with ${name}. That's fine if you held both roles at once — otherwise check the dates.`;
    });
  }, [form.workExperiences]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (form.yearsOfExperience === '') e.yearsOfExperience = 'Years of experience is required.';

    form.workExperiences.forEach((w, i) => {
      if (!w.title.trim()) e[`workExperiences.${i}.title`] = 'Job title is required.';
      else if (!w.company.trim()) e[`workExperiences.${i}.company`] = 'Company is required.';
      else if (!w.startYear) e[`workExperiences.${i}.startYear`] = 'Start year is required.';
      // Only the current position's URL becomes the approved member's public firm website, so
      // past roles stay optional — any URL works, including a LinkedIn company/profile page.
      else if (w.isCurrent && !w.companyUrl?.trim())
        e[`workExperiences.${i}.companyUrl`] = 'Add a website for your current position.';
    });
    dateErrors.forEach((msg, i) => {
      if (
        msg &&
        !e[`workExperiences.${i}.title`] &&
        !e[`workExperiences.${i}.company`] &&
        !e[`workExperiences.${i}.startYear`]
      )
        e[`workExperiences.${i}.dates`] = msg;
    });
    // One entry must be marked as the applicant's current position — it becomes the approved
    // member's firm name, so it can't be silently absent (backend enforces this too, at submit).
    if (Object.keys(e).length === 0 && !form.workExperiences.some((w) => w.isCurrent && w.company.trim())) {
      e.workExperiencesCurrent = 'Mark your current position — this becomes your firm name once approved.';
    }
    form.educations.forEach((edu, i) => {
      if (!edu.institution.trim()) e[`educations.${i}.institution`] = 'Institution is required.';
      else if (!edu.degree.trim()) e[`educations.${i}.degree`] = 'Degree is required.';
    });
    (collectReferences ? form.peerReferences : []).forEach((r, i) => {
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
    update({ workExperiences: sortWorkHistoryNewestFirst(form.workExperiences) });
    onNext();
  }

  // Clears one or more field errors as soon as their value changes, instead of leaving a stale
  // red border/message on screen until the next full-form validation pass.
  function clearErrors(fields: string[]) {
    setErrors((prev) => {
      if (!fields.some((f) => f in prev)) return prev;
      const next = { ...prev };
      for (const f of fields) delete next[f];
      return next;
    });
  }

  function updateWork(index: number, patch: Partial<WizardFormState['workExperiences'][number]>) {
    const next = [...form.workExperiences];
    next[index] = { ...next[index], ...patch };
    update({ workExperiences: next });
    const fieldsToClear = Object.keys(patch).map((key) => `workExperiences.${index}.${key}`);
    if ('isCurrent' in patch || 'company' in patch) fieldsToClear.push('workExperiencesCurrent');
    // Unmarking an entry as current drops its own companyUrl requirement — clear any stale error.
    if ('isCurrent' in patch && !patch.isCurrent) fieldsToClear.push(`workExperiences.${index}.companyUrl`);
    clearErrors(fieldsToClear);
  }

  function updateEdu(index: number, patch: Partial<WizardFormState['educations'][number]>) {
    const next = [...form.educations];
    next[index] = { ...next[index], ...patch };
    update({ educations: next });
    clearErrors(Object.keys(patch).map((key) => `educations.${index}.${key}`));
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

      <div className="mt-7 flex items-baseline justify-between">
        <span className="flex items-center gap-2 text-mono-label text-ink-3">
          WORK EXPERIENCE
          {form.importedFields.has('workExperiences') && <ImportedTag />}
        </span>
        <span className="text-xs text-ink-3">1 required · up to {WORK_EXPERIENCES_MAX} entries</span>
      </div>

      {/* Overall seniority sits with the roles it summarises, rather than as a lone field above. */}
      <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-line bg-bg-card px-6 py-4 max-[480px]:flex-col max-[480px]:items-stretch max-[480px]:px-5">
        <div className="min-w-0">
          <label htmlFor="yearsOfExperience" className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            Overall years of experience
            <span aria-hidden="true" className="text-error">
              *
            </span>
            {form.importedFields.has('yearsOfExperience') && <ImportedTag />}
            {form.yearsOfExperienceCalculated && <Badge variant="neutral">Calculated from your roles</Badge>}
          </label>
          <p className="mt-0.5 text-xs text-ink-3">Across your whole career, including roles not listed below.</p>
        </div>
        <div className="w-[140px] shrink-0 max-[480px]:w-full">
          <Input
            id="yearsOfExperience"
            label=""
            name="yearsOfExperience"
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            placeholder="e.g. 12"
            value={form.yearsOfExperience}
            onChange={(e) => {
              update({ yearsOfExperience: e.target.value, yearsOfExperienceCalculated: false });
              clearErrors(['yearsOfExperience']);
            }}
            error={errors.yearsOfExperience}
            required
          />
        </div>
      </div>

      {errors.workExperiencesCurrent && (
        <div className="mt-3">
          <ErrorBanner message={errors.workExperiencesCurrent} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {form.workExperiences.map((work, i) => (
          <div key={i} className="rounded-2xl border border-line bg-bg-card p-6">
            <div className="mb-3.5 flex items-baseline justify-between">
              <span className="text-mono-label text-ink-3">Experience {String(i + 1).padStart(2, '0')}</span>
              {form.workExperiences.length > 1 && (
                <button
                  type="button"
                  onClick={() => update({ workExperiences: form.workExperiences.filter((_, j) => j !== i) })}
                  className="text-xs font-medium text-error"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <Input
                id={`workExperiences.${i}.title`}
                label="Job title"
                placeholder="Partner"
                value={work.title}
                onChange={(e) => updateWork(i, { title: e.target.value })}
                error={errors[`workExperiences.${i}.title`]}
              />
              <Input
                id={`workExperiences.${i}.company`}
                label="Company"
                placeholder="Firm name"
                value={work.company}
                onChange={(e) => updateWork(i, { company: e.target.value })}
                error={errors[`workExperiences.${i}.company`]}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <Input
                label="City"
                placeholder="e.g. London"
                value={work.city ?? ''}
                onChange={(e) => updateWork(i, { city: e.target.value })}
              />
              <Select
                label="Firm size"
                value={work.firmSize ?? ''}
                onChange={(e) => updateWork(i, { firmSize: e.target.value as typeof work.firmSize })}
              >
                <option value="">Select…</option>
                {FIRM_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-4">
              <Input
                id={`workExperiences.${i}.companyUrl`}
                label="Company website"
                labelRight={
                  work.isCurrent ? undefined : <span className="text-xs font-normal text-ink-3">optional</span>
                }
                type="url"
                placeholder="https://example.com — or a LinkedIn company/profile page"
                value={work.companyUrl ?? ''}
                onChange={(e) => updateWork(i, { companyUrl: e.target.value })}
                error={errors[`workExperiences.${i}.companyUrl`]}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <span id={`workExperiences.${i}.startLabel`} className="text-xs font-medium text-ink-2">
                  Start date
                </span>
                <div role="group" aria-labelledby={`workExperiences.${i}.startLabel`} className="flex gap-2">
                  <select
                    aria-label="Start month"
                    className={`min-w-0 flex-1 rounded-input border border-line px-2 py-3 text-sm text-ink ${FIELD_FOCUS}`}
                    value={work.startMonth ?? ''}
                    onChange={(e) => updateWork(i, { startMonth: Number(e.target.value) || undefined })}
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    id={`workExperiences.${i}.startYear`}
                    aria-label="Start year"
                    aria-invalid={errors[`workExperiences.${i}.startYear`] ? true : undefined}
                    className={`min-w-0 flex-1 rounded-input border px-2 py-3 text-sm text-ink ${
                      errors[`workExperiences.${i}.startYear`]
                        ? `border-error ${FIELD_FOCUS_ERROR}`
                        : `border-line ${FIELD_FOCUS}`
                    }`}
                    value={work.startYear || ''}
                    onChange={(e) => updateWork(i, { startYear: Number(e.target.value) })}
                  >
                    <option value="">Year</option>
                    {YEARS.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </div>
                {errors[`workExperiences.${i}.startYear`] && (
                  <span className="text-xs text-error">{errors[`workExperiences.${i}.startYear`]}</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span id={`workExperiences.${i}.endLabel`} className="text-xs font-medium text-ink-2">
                  End date
                </span>
                <div role="group" aria-labelledby={`workExperiences.${i}.endLabel`} className="flex gap-2">
                  <select
                    disabled={work.isCurrent}
                    aria-label="End month"
                    className={`min-w-0 flex-1 rounded-input border border-line px-2 py-3 text-sm text-ink disabled:opacity-40 ${FIELD_FOCUS}`}
                    value={work.endMonth ?? ''}
                    onChange={(e) => updateWork(i, { endMonth: Number(e.target.value) || undefined })}
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <select
                    disabled={work.isCurrent}
                    aria-label="End year"
                    className={`min-w-0 flex-1 rounded-input border border-line px-2 py-3 text-sm text-ink disabled:opacity-40 ${FIELD_FOCUS}`}
                    value={work.endYear ?? ''}
                    onChange={(e) => updateWork(i, { endYear: Number(e.target.value) || undefined })}
                  >
                    <option value="">Year</option>
                    {YEARS.map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {dateErrors[i] && (
              <span id={`workExperiences.${i}.dates`} tabIndex={-1} className="mt-2 block text-xs text-error">
                {dateErrors[i]}
              </span>
            )}
            {!dateErrors[i] && dateWarnings[i] && <WarningNote className="mt-3">{dateWarnings[i]}</WarningNote>}

            <label className="mt-4 flex items-center gap-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={work.isCurrent}
                onChange={(e) =>
                  updateWork(i, {
                    isCurrent: e.target.checked,
                    endMonth: e.target.checked ? undefined : work.endMonth,
                    endYear: e.target.checked ? undefined : work.endYear,
                  })
                }
              />
              I currently work here
            </label>

            <div className="mt-4">
              <Textarea
                label="Description"
                labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                rows={3}
                maxLength={2000}
                autoGrow
                placeholder="What you did in this role — shown on your profile."
                value={work.description ?? ''}
                onChange={(e) => updateWork(i, { description: e.target.value })}
              />
            </div>
          </div>
        ))}
      </div>

      {form.workExperiences.length < WORK_EXPERIENCES_MAX && (
        <button
          type="button"
          onClick={() => update({ workExperiences: [...form.workExperiences, { ...EMPTY_WORK_EXPERIENCE }] })}
          className="mt-3 rounded-input border border-line-2 px-5 py-2.5 text-sm font-medium text-ink hover:border-ink"
        >
          + Add another role
        </button>
      )}

      <div className="mt-8 flex items-baseline justify-between border-t border-line pt-6">
        <span className="flex items-center gap-2 text-mono-label text-ink-3">
          EDUCATION &amp; QUALIFICATIONS
          {form.importedFields.has('educations') && <ImportedTag />}
        </span>
        <span className="text-xs text-ink-3">1 required · up to {EDUCATIONS_MAX} entries</span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {form.educations.map((edu, i) => (
          <div key={i} className="rounded-2xl border border-line bg-bg-card p-6">
            <div className="mb-3.5 flex items-baseline justify-between">
              <span className="text-mono-label text-ink-3">Education {String(i + 1).padStart(2, '0')}</span>
              {form.educations.length > 1 && (
                <button
                  type="button"
                  onClick={() => update({ educations: form.educations.filter((_, j) => j !== i) })}
                  className="text-xs font-medium text-error"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <Input
                id={`educations.${i}.institution`}
                label="Institution"
                placeholder="University name"
                value={edu.institution}
                onChange={(e) => updateEdu(i, { institution: e.target.value })}
                error={errors[`educations.${i}.institution`]}
              />
              <Input
                id={`educations.${i}.degree`}
                label="Degree"
                placeholder="LLB, MBA…"
                value={edu.degree}
                onChange={(e) => updateEdu(i, { degree: e.target.value })}
                error={errors[`educations.${i}.degree`]}
              />
            </div>

            <div className="mt-4">
              <Input
                label="Field of study"
                placeholder="e.g. Corporate Law"
                value={edu.fieldOfStudy ?? ''}
                onChange={(e) => updateEdu(i, { fieldOfStudy: e.target.value })}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <Input
                label="Start year"
                type="number"
                min={1950}
                max={2030}
                placeholder="2010"
                value={edu.startYear ?? ''}
                onChange={(e) => updateEdu(i, { startYear: Number(e.target.value) || undefined })}
              />
              <Input
                label="End year"
                type="number"
                min={1950}
                max={2030}
                placeholder="2014"
                value={edu.endYear ?? ''}
                onChange={(e) => updateEdu(i, { endYear: Number(e.target.value) || undefined })}
              />
            </div>
          </div>
        ))}
      </div>

      {form.educations.length < EDUCATIONS_MAX && (
        <button
          type="button"
          onClick={() => update({ educations: [...form.educations, { ...EMPTY_EDUCATION }] })}
          className="mt-3 rounded-input border border-line-2 px-5 py-2.5 text-sm font-medium text-ink hover:border-ink"
        >
          + Add another qualification
        </button>
      )}

      {/* Not collected during the founding-cohort pre-launch (SITE_LAUNCHED=false). */}
      {collectReferences && (
        <>
          <div className="mt-8 flex items-baseline justify-between border-t border-line pt-6">
            <span className="text-mono-label text-ink-3">PEER REFERENCES</span>
            <span className="text-xs text-ink-3">2 required, as part of verification</span>
          </div>
          <p className="mt-1.5 text-sm text-ink-3">Two professional peers we can contact to verify your background.</p>

          <div className="mt-4 flex flex-col gap-4">
            {form.peerReferences.map((reference, i) => (
              <div key={i} className="rounded-2xl border border-line bg-bg-card p-6">
                <span className="text-mono-label text-ink-3">Reference {String(i + 1).padStart(2, '0')}</span>

                <div className="mt-3.5 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                  <Input
                    id={`peerReferences.${i}.name`}
                    label="Full name"
                    value={reference.name}
                    onChange={(e) => updateReference(i, { name: e.target.value })}
                    error={errors[`peerReferences.${i}.name`]}
                  />
                  <Input
                    id={`peerReferences.${i}.relationship`}
                    label="Relationship"
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
        </>
      )}

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
