'use client';

import { Input } from '@/components/ui/Input';
import { ImportedTag } from '@/components/apply/ImportedTag';
import { EMPTY_EDUCATION, type WizardFormState } from '@/components/apply/types';

// Mirrors EDUCATIONS_MAX in the backend's update-application.dto.ts.
const EDUCATIONS_MAX = 5;

/** Education & qualifications cards. Used by the wizard and the admin review editor. */
export function EducationFields({
  form,
  update,
  errors,
  clearErrors,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  errors: Record<string, string>;
  clearErrors: (fields: string[]) => void;
}) {
  function updateEdu(index: number, patch: Partial<WizardFormState['educations'][number]>) {
    const next = [...form.educations];
    next[index] = { ...next[index], ...patch };
    update({ educations: next });
    clearErrors(Object.keys(patch).map((key) => `educations.${index}.${key}`));
  }

  return (
    <>
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
                markRequired
                placeholder="University name"
                value={edu.institution}
                onChange={(e) => updateEdu(i, { institution: e.target.value })}
                error={errors[`educations.${i}.institution`]}
              />
              <Input
                id={`educations.${i}.degree`}
                label="Degree"
                markRequired
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
    </>
  );
}
