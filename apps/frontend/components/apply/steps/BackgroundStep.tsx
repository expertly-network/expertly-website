'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StepActions } from '@/components/apply/StepActions';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ImportedTag } from '@/components/apply/ImportedTag';
import {
  EMPTY_EDUCATION,
  EMPTY_WORK_EXPERIENCE,
  FIRM_SIZES,
  REQUIRED_MSG,
  useAttemptedNext,
  type WizardFormState,
} from '@/components/apply/types';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const YEARS = Array.from({ length: 67 }, (_, i) => new Date().getFullYear() - i);

function workExperienceValid(w: WizardFormState['workExperiences'][number]) {
  const hasStart = Boolean(w.startMonth && w.startYear);
  const hasEnd = w.isCurrent || Boolean(w.endMonth && w.endYear);
  return Boolean(w.title.trim() && w.company.trim() && hasStart && hasEnd);
}

function educationValid(e: WizardFormState['educations'][number]) {
  return Boolean(e.institution.trim() && e.degree.trim());
}

// expandedWork/expandedEdu track expand state by array index — removing entry `removed` shifts
// every later index down by one, so the Set has to be re-keyed or the wrong cards end up
// expanded/collapsed after a removal.
function reindexAfterRemoval(expanded: Set<number>, removed: number): Set<number> {
  const next = new Set<number>();
  expanded.forEach((i) => {
    if (i < removed) next.add(i);
    else if (i > removed) next.add(i - 1);
  });
  return next;
}

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
  // Only the first entry starts expanded; the rest are collapsed to a summary row until clicked.
  // Multiple entries can be expanded at once — this isn't an exclusive accordion.
  const [expandedWork, setExpandedWork] = useState<Set<number>>(() => new Set([0]));
  const [expandedEdu, setExpandedEdu] = useState<Set<number>>(() => new Set([0]));

  const canContinue = Boolean(
    form.yearsOfExperience !== '' &&
      form.workExperiences.every(workExperienceValid) &&
      form.educations.every(educationValid)
  );

  const { attempted, handleNext } = useAttemptedNext(canContinue, onNext, () => {
    // Auto-expand any invalid entry so its errors are actually visible, not hidden collapsed.
    setExpandedWork((prev) => {
      const next = new Set(prev);
      form.workExperiences.forEach((w, i) => {
        if (!workExperienceValid(w)) next.add(i);
      });
      return next;
    });
    setExpandedEdu((prev) => {
      const next = new Set(prev);
      form.educations.forEach((e, i) => {
        if (!educationValid(e)) next.add(i);
      });
      return next;
    });
  });

  function toggleWork(i: number) {
    setExpandedWork((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleEdu(i: number) {
    setExpandedEdu((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function removeWork(i: number) {
    update({ workExperiences: form.workExperiences.filter((_, j) => j !== i) });
    setExpandedWork((prev) => reindexAfterRemoval(prev, i));
  }

  function removeEdu(i: number) {
    update({ educations: form.educations.filter((_, j) => j !== i) });
    setExpandedEdu((prev) => reindexAfterRemoval(prev, i));
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

  return (
    <div>
      <h2 className="text-heading text-ink">Your background.</h2>
      <p className="mt-2 text-sm text-ink-3">Work history, qualifications, and overall seniority.</p>

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
          required
          error={attempted && form.yearsOfExperience === '' ? REQUIRED_MSG : undefined}
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
        {form.workExperiences.map((work, i) => {
          const isOpen = expandedWork.has(i);
          const invalid = attempted && !workExperienceValid(work);

          return (
            <div
              key={i}
              className={`rounded-2xl border bg-bg-card ${invalid ? 'border-error' : 'border-line'}`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleWork(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleWork(i);
                  }
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 p-6 text-left"
              >
                <div className="min-w-0">
                  <span className="text-mono-label text-ink-3">
                    Experience {String(i + 1).padStart(2, '0')}
                  </span>
                  {!isOpen && (
                    <div className="mt-1 truncate text-sm text-ink">
                      {work.title.trim() || work.company.trim()
                        ? `${work.title || 'Untitled role'} at ${work.company || 'Unknown company'}`
                        : 'New role — click to fill in'}
                    </div>
                  )}
                </div>
                <div className="flex flex-none items-center gap-3">
                  {invalid && !isOpen && <span className="text-xs text-error">{REQUIRED_MSG}</span>}
                  {form.workExperiences.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeWork(i);
                      }}
                      className="text-xs font-medium text-error"
                    >
                      Remove
                    </button>
                  )}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`h-4 w-4 flex-none text-ink-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {isOpen && (
                <div className="px-6 pb-6">
                  <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                    <Input
                      label="Job title"
                      placeholder="Partner"
                      value={work.title}
                      onChange={(e) => updateWork(i, { title: e.target.value })}
                      required
                      error={attempted && !work.title.trim() ? REQUIRED_MSG : undefined}
                    />
                    <Input
                      label="Company"
                      placeholder="Firm name"
                      value={work.company}
                      onChange={(e) => updateWork(i, { company: e.target.value })}
                      required
                      error={attempted && !work.company.trim() ? REQUIRED_MSG : undefined}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                    <Input
                      label="City"
                      labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                      placeholder="e.g. London"
                      value={work.city ?? ''}
                      onChange={(e) => updateWork(i, { city: e.target.value })}
                    />
                    <Select
                      label="Firm size"
                      labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
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
                      <label className="text-xs font-medium text-ink-2">
                        Start date <span className="font-normal text-error">*</span>
                      </label>
                      <div className="flex gap-2">
                        <select
                          className={`min-w-0 flex-1 rounded-input border px-2 py-3 text-sm text-ink outline-none ${
                            attempted && !work.startMonth ? 'border-error' : 'border-line'
                          }`}
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
                          className={`min-w-0 flex-1 rounded-input border px-2 py-3 text-sm text-ink outline-none ${
                            attempted && !work.startYear ? 'border-error' : 'border-line'
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
                      {attempted && (!work.startMonth || !work.startYear) && (
                        <span className="text-xs text-error">Start month and year are required.</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium text-ink-2">
                        End date {!work.isCurrent && <span className="font-normal text-error">*</span>}
                      </label>
                      <div className="flex gap-2">
                        <select
                          disabled={work.isCurrent}
                          className={`min-w-0 flex-1 rounded-input border px-2 py-3 text-sm text-ink outline-none disabled:opacity-40 ${
                            attempted && !work.isCurrent && !work.endMonth ? 'border-error' : 'border-line'
                          }`}
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
                          className={`min-w-0 flex-1 rounded-input border px-2 py-3 text-sm text-ink outline-none disabled:opacity-40 ${
                            attempted && !work.isCurrent && !work.endYear ? 'border-error' : 'border-line'
                          }`}
                          value={work.endYear ?? ''}
                          onChange={(e) => updateWork(i, { endYear: Number(e.target.value) || undefined })}
                        >
                          <option value="">Year</option>
                          {YEARS.map((y) => (
                            <option key={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      {attempted && !work.isCurrent && (!work.endMonth || !work.endYear) && (
                        <span className="text-xs text-error">End month and year are required.</span>
                      )}
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
              )}
            </div>
          );
        })}
      </div>

      {form.workExperiences.length < 5 && (
        <button
          type="button"
          onClick={() => {
            const newIndex = form.workExperiences.length;
            update({ workExperiences: [...form.workExperiences, { ...EMPTY_WORK_EXPERIENCE }] });
            setExpandedWork((prev) => new Set(prev).add(newIndex));
          }}
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
        {form.educations.map((edu, i) => {
          const isOpen = expandedEdu.has(i);
          const invalid = attempted && !educationValid(edu);

          return (
            <div
              key={i}
              className={`rounded-2xl border bg-bg-card ${invalid ? 'border-error' : 'border-line'}`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggleEdu(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleEdu(i);
                  }
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-3 p-6 text-left"
              >
                <div className="min-w-0">
                  <span className="text-mono-label text-ink-3">
                    Education {String(i + 1).padStart(2, '0')}
                  </span>
                  {!isOpen && (
                    <div className="mt-1 truncate text-sm text-ink">
                      {edu.institution.trim() || edu.degree.trim()
                        ? `${edu.degree || 'Untitled qualification'}, ${edu.institution || 'Unknown institution'}`
                        : 'New qualification — click to fill in'}
                    </div>
                  )}
                </div>
                <div className="flex flex-none items-center gap-3">
                  {invalid && !isOpen && <span className="text-xs text-error">{REQUIRED_MSG}</span>}
                  {form.educations.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEdu(i);
                      }}
                      className="text-xs font-medium text-error"
                    >
                      Remove
                    </button>
                  )}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={`h-4 w-4 flex-none text-ink-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>

              {isOpen && (
                <div className="px-6 pb-6">
                  <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                    <Input
                      label="Institution"
                      placeholder="University name"
                      value={edu.institution}
                      onChange={(e) => updateEdu(i, { institution: e.target.value })}
                      required
                      error={attempted && !edu.institution.trim() ? REQUIRED_MSG : undefined}
                    />
                    <Input
                      label="Degree"
                      placeholder="LLB, MBA…"
                      value={edu.degree}
                      onChange={(e) => updateEdu(i, { degree: e.target.value })}
                      required
                      error={attempted && !edu.degree.trim() ? REQUIRED_MSG : undefined}
                    />
                  </div>

                  <div className="mt-4">
                    <Input
                      label="Field of study"
                      labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                      placeholder="e.g. Corporate Law"
                      value={edu.fieldOfStudy ?? ''}
                      onChange={(e) => updateEdu(i, { fieldOfStudy: e.target.value })}
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                    <Input
                      label="Start year"
                      labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                      type="number"
                      min={1950}
                      max={2030}
                      placeholder="2010"
                      value={edu.startYear ?? ''}
                      onChange={(e) => updateEdu(i, { startYear: Number(e.target.value) || undefined })}
                    />
                    <Input
                      label="End year"
                      labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                      type="number"
                      min={1950}
                      max={2030}
                      placeholder="2014"
                      value={edu.endYear ?? ''}
                      onChange={(e) => updateEdu(i, { endYear: Number(e.target.value) || undefined })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {form.educations.length < 3 && (
        <button
          type="button"
          onClick={() => {
            const newIndex = form.educations.length;
            update({ educations: [...form.educations, { ...EMPTY_EDUCATION }] });
            setExpandedEdu((prev) => new Set(prev).add(newIndex));
          }}
          className="mt-3 rounded-input border border-line-2 px-5 py-2.5 text-sm font-medium text-ink hover:border-ink"
        >
          + Add another qualification
        </button>
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
