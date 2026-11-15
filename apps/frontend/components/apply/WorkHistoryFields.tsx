'use client';

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { MonthYearField } from '@/components/ui/MonthYearField';
import { Textarea } from '@/components/ui/Textarea';
import { WarningNote } from '@/components/ui/WarningNote';
import { Badge } from '@/components/ui/Badge';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ImportedTag } from '@/components/apply/ImportedTag';
import { findOverlaps, isEndBeforeStart } from '@/lib/apply/work-history';
import { shareCompanyWebsites } from '@/lib/apply/company-websites';
import { groupByCompany } from '@/lib/apply/background-errors';
import { EMPTY_WORK_EXPERIENCE, FIRM_SIZES, type WizardFormState } from '@/components/apply/types';

// Mirrors WORK_EXPERIENCES_MAX in the backend's update-application.dto.ts.
const WORK_EXPERIENCES_MAX = 15;

// Below this, an application isn't approved (5–12 years is Budding Professional, more is Seasoned).
const MIN_YEARS_OF_EXPERIENCE = 5;

type WorkExperience = WizardFormState['workExperiences'][number];

/** Overall years + work history, grouped by company. Used by the wizard and the admin review editor. */
export function WorkHistoryFields({
  form,
  update,
  errors,
  setErrors,
  clearErrors,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  errors: Record<string, string>;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
  clearErrors: (fields: string[]) => void;
}) {
  const workExperiences = shareCompanyWebsites(form.workExperiences);
  // Roles at the same company share one box: the company's own details (name, and for the current
  // company its size and website) are asked once, then each role underneath. The data stays a
  // flat list of roles — this grouping is only how the form presents it.
  const companies = groupByCompany(workExperiences);

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

  function updateWork(index: number, patch: Partial<WorkExperience>) {
    const next = [...workExperiences];
    next[index] = { ...next[index], ...patch };
    update({ workExperiences: shareCompanyWebsites(next) });
    const fieldsToClear = Object.keys(patch).map((key) => `workExperiences.${index}.${key}`);
    if ('isCurrent' in patch) fieldsToClear.push('workExperiencesCurrent');
    clearErrors(fieldsToClear);
  }

  // Company-level fields (name, size, website) are written to every role in that company's box.
  function updateCompany(roles: number[], patch: Partial<Pick<WorkExperience, 'company' | 'firmSize' | 'companyUrl'>>) {
    const next = workExperiences.map((w, i) => (roles.includes(i) ? { ...w, ...patch } : w));
    update({ workExperiences: shareCompanyWebsites(next) });
    const fieldsToClear = Object.keys(patch).map((key) => `workExperiences.${roles[0]}.${key}`);
    if ('company' in patch) fieldsToClear.push('workExperiencesCurrent');
    clearErrors(fieldsToClear);
  }

  // A new role in an existing company's box, right after its last role.
  function addRoleAt(roles: number[]) {
    const company = workExperiences[roles[0]];
    const next = [...workExperiences];
    next.splice(roles[roles.length - 1] + 1, 0, {
      ...EMPTY_WORK_EXPERIENCE,
      company: company.company,
      firmSize: companyValue(roles, 'firmSize'),
      companyUrl: companyValue(roles, 'companyUrl'),
    });
    update({ workExperiences: next });
    setErrors({});
  }

  function removeRoles(roles: number[]) {
    update({ workExperiences: workExperiences.filter((_, i) => !roles.includes(i)) });
    setErrors({});
  }

  const isCurrentCompany = (roles: number[]) => roles.some((i) => workExperiences[i].isCurrent);
  const companyValue = <K extends 'firmSize' | 'companyUrl'>(roles: number[], key: K): WorkExperience[K] =>
    roles.map((i) => workExperiences[i][key]).find((v) => v) ?? undefined;

  return (
    <>
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
      {/* Heads-up only — the ops team decides, but under the minimum isn't approved, so say so
          before they spend time on the rest of the form. */}
      {form.yearsOfExperience !== '' && Number(form.yearsOfExperience) < MIN_YEARS_OF_EXPERIENCE && (
        <WarningNote className="mt-3">
          GrowXQ membership is for professionals with {MIN_YEARS_OF_EXPERIENCE} or more years of experience, and
          applications below that aren&apos;t approved. If your figure is understated, adjust it above.
        </WarningNote>
      )}

      {errors.workExperiencesCurrent && (
        <div className="mt-3">
          <ErrorBanner message={errors.workExperiencesCurrent} />
        </div>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {companies.map(({ roles }, c) => {
          const first = roles[0];
          const company = workExperiences[first];
          const current = isCurrentCompany(roles);
          return (
            <div key={first} className="rounded-2xl border border-line bg-bg-card p-6 max-[480px]:p-5">
              <div className="mb-3.5 flex items-baseline justify-between">
                <span className="text-mono-label text-ink-3">Company {String(c + 1).padStart(2, '0')}</span>
                {companies.length > 1 && (
                  <button type="button" onClick={() => removeRoles(roles)} className="text-xs font-medium text-error">
                    Remove company
                  </button>
                )}
              </div>

              <Input
                id={`workExperiences.${first}.company`}
                label="Company"
                markRequired
                placeholder="Firm name"
                value={company.company}
                onChange={(e) => updateCompany(roles, { company: e.target.value })}
                error={errors[`workExperiences.${first}.company`]}
              />

              {/* Asked only for the company they work at now — a past company's size and website
                  aren't shown anywhere, so they aren't collected. */}
              {current && (
                <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                  <Select
                    id={`workExperiences.${first}.firmSize`}
                    label="Firm size"
                    markRequired
                    value={companyValue(roles, 'firmSize') ?? ''}
                    onChange={(e) =>
                      updateCompany(roles, { firmSize: (e.target.value || undefined) as WorkExperience['firmSize'] })
                    }
                    error={errors[`workExperiences.${first}.firmSize`]}
                  >
                    <option value="">Select…</option>
                    {FIRM_SIZES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    id={`workExperiences.${first}.companyUrl`}
                    label="Company website"
                    markRequired
                    type="url"
                    placeholder="https://example.com — or a LinkedIn page"
                    value={companyValue(roles, 'companyUrl') ?? ''}
                    onChange={(e) => updateCompany(roles, { companyUrl: e.target.value })}
                    error={errors[`workExperiences.${first}.companyUrl`]}
                  />
                </div>
              )}

              {roles.map((i, r) => {
                const work = workExperiences[i];
                return (
                  <div key={i} className="mt-5 border-t border-line pt-5">
                    <div className="mb-3.5 flex items-baseline justify-between">
                      <span className="text-mono-label text-ink-3">{roles.length > 1 ? `Role ${r + 1}` : 'Role'}</span>
                      {roles.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRoles([i])}
                          className="text-xs font-medium text-error"
                        >
                          Remove role
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                      <Input
                        id={`workExperiences.${i}.title`}
                        label="Job title"
                        markRequired
                        placeholder="Partner"
                        value={work.title}
                        onChange={(e) => updateWork(i, { title: e.target.value })}
                        error={errors[`workExperiences.${i}.title`]}
                      />
                      <Input
                        label="City"
                        placeholder="e.g. London"
                        value={work.city ?? ''}
                        onChange={(e) => updateWork(i, { city: e.target.value })}
                      />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                      <MonthYearField
                        label="Start date"
                        required
                        month={work.startMonth}
                        year={work.startYear || undefined}
                        yearId={`workExperiences.${i}.startYear`}
                        error={errors[`workExperiences.${i}.startYear`]}
                        onMonthChange={(startMonth) => updateWork(i, { startMonth })}
                        onYearChange={(startYear) => updateWork(i, { startYear: startYear ?? 0 })}
                      />
                      <MonthYearField
                        label="End date"
                        disabled={work.isCurrent}
                        month={work.endMonth}
                        year={work.endYear}
                        onMonthChange={(endMonth) => updateWork(i, { endMonth })}
                        onYearChange={(endYear) => updateWork(i, { endYear })}
                      />
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
                );
              })}

              {form.workExperiences.length < WORK_EXPERIENCES_MAX && company.company.trim() && (
                <button
                  type="button"
                  onClick={() => addRoleAt(roles)}
                  className="mt-4 text-sm font-medium text-accent hover:text-ink"
                >
                  + Add another role at {company.company.trim()}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {form.workExperiences.length < WORK_EXPERIENCES_MAX && (
        <button
          type="button"
          onClick={() => update({ workExperiences: [...form.workExperiences, { ...EMPTY_WORK_EXPERIENCE }] })}
          className="mt-3 rounded-input border border-line-2 px-5 py-2.5 text-sm font-medium text-ink hover:border-ink"
        >
          + Add another company
        </button>
      )}
    </>
  );
}
