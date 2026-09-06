'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StepActions } from '@/components/apply/StepActions';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ImportedTag } from '@/components/apply/ImportedTag';
import { scrollToFirstError } from '@/components/apply/scrollToError';
import {
  EMPTY_EDUCATION,
  EMPTY_WORK_EXPERIENCE,
  FIRM_SIZES,
  type WizardFormState,
} from '@/components/apply/types';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const YEARS = Array.from({ length: 67 }, (_, i) => new Date().getFullYear() - i);

export function BackgroundStep({
  form,
  update,
  saving,
  saveError,
  onBack,
  onNext,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  saving?: boolean;
  saveError?: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (form.yearsOfExperience === '') e.yearsOfExperience = 'Years of experience is required.';

    form.workExperiences.forEach((w, i) => {
      if (!w.title.trim()) e[`workExperiences.${i}.title`] = 'Job title is required.';
      else if (!w.company.trim()) e[`workExperiences.${i}.company`] = 'Company is required.';
      else if (!w.startYear) e[`workExperiences.${i}.startYear`] = 'Start year is required.';
    });
    form.educations.forEach((edu, i) => {
      if (!edu.institution.trim()) e[`educations.${i}.institution`] = 'Institution is required.';
      else if (!edu.degree.trim()) e[`educations.${i}.degree`] = 'Degree is required.';
    });
    form.peerReferences.forEach((r, i) => {
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
    onNext();
  }

  function updateWork(index: number, patch: Partial<WizardFormState['workExperiences'][number]>) {
    const next = [...form.workExperiences];
    next[index] = { ...next[index], ...patch };
    update({ workExperiences: next });
  }

  function updateEdu(index: number, patch: Partial<WizardFormState['educations'][number]>) {
    const next = [...form.educations];
    next[index] = { ...next[index], ...patch };
    update({ educations: next });
  }

  function updateReference(index: number, patch: Partial<WizardFormState['peerReferences'][number]>) {
    const next = [...form.peerReferences];
    next[index] = { ...next[index], ...patch };
    update({ peerReferences: next });
  }

  return (
    <div>
      <h2 className="text-heading text-ink">Your background.</h2>
      <p className="mt-2 text-lede text-ink-3">Work history, qualifications, and overall seniority.</p>

      <div className="mt-7 max-w-[220px]">
        <Input
          label="Overall years of experience"
          labelRight={form.importedFields.has('yearsOfExperience') ? <ImportedTag /> : undefined}
          name="yearsOfExperience"
          type="number"
          min={0}
          max={60}
          placeholder="e.g. 12"
          value={form.yearsOfExperience}
          onChange={(e) => update({ yearsOfExperience: e.target.value })}
          error={errors.yearsOfExperience}
          required
        />
      </div>

      <div className="mt-8 flex items-baseline justify-between border-t border-line pt-6">
        <span className="flex items-center gap-2 text-mono-label text-ink-3">
          WORK EXPERIENCE
          {form.importedFields.has('workExperiences') && <ImportedTag />}
        </span>
        <span className="text-xs text-ink-3">1 required · up to 5 entries</span>
      </div>

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
                label="Company website"
                labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                type="url"
                placeholder="https://example.com"
                value={work.companyUrl ?? ''}
                onChange={(e) => updateWork(i, { companyUrl: e.target.value })}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-ink-2">Start date</label>
                <div className="flex gap-2">
                  <select
                    className="min-w-0 flex-1 rounded-input border border-line px-2 py-3 text-sm text-ink outline-none"
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
                    className={`min-w-0 flex-1 rounded-input border px-2 py-3 text-sm text-ink outline-none ${
                      errors[`workExperiences.${i}.startYear`] ? 'border-error' : 'border-line'
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
                <label className="text-xs font-medium text-ink-2">End date</label>
                <div className="flex gap-2">
                  <select
                    disabled={work.isCurrent}
                    className="min-w-0 flex-1 rounded-input border border-line px-2 py-3 text-sm text-ink outline-none disabled:opacity-40"
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
                    className="min-w-0 flex-1 rounded-input border border-line px-2 py-3 text-sm text-ink outline-none disabled:opacity-40"
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
          </div>
        ))}
      </div>

      {form.workExperiences.length < 5 && (
        <button
          type="button"
          onClick={() =>
            update({ workExperiences: [...form.workExperiences, { ...EMPTY_WORK_EXPERIENCE }] })
          }
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
        <span className="text-xs text-ink-3">1 required · up to 3 entries</span>
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

      {form.educations.length < 3 && (
        <button
          type="button"
          onClick={() => update({ educations: [...form.educations, { ...EMPTY_EDUCATION }] })}
          className="mt-3 rounded-input border border-line-2 px-5 py-2.5 text-sm font-medium text-ink hover:border-ink"
        >
          + Add another qualification
        </button>
      )}

      <div className="mt-8 flex items-baseline justify-between border-t border-line pt-6">
        <span className="text-mono-label text-ink-3">PEER REFERENCES</span>
        <span className="text-xs text-ink-3">2 required, as part of verification</span>
      </div>
      <p className="mt-1.5 text-sm text-ink-3">
        Two professional peers we can contact to verify your background.
      </p>

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
