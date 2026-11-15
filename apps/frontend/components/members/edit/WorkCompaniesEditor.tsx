'use client';

import { useState, type ReactNode } from 'react';
import { Input } from '@/components/ui';
import { WarningNote } from '@/components/ui/WarningNote';
import { ProofAttachments } from '@/components/members/edit/ProofAttachments';
import { PROOF_EXAMPLES, SECTION_CONFIG, type FieldSpec } from '@/components/members/edit/sectionFieldConfig';
import type { ProofAttachment } from '@shared/member';

type Row = Record<string, unknown>;

/** UI-only key tying the roles of one company together while the member edits (stripped on save). */
export const GROUP_KEY = '_group';

const newGroupId = () => `g${Math.random().toString(36).slice(2, 10)}`;

/** Tags saved roles with a group per company, using the same rule the profile page groups by. */
export function withCompanyGroups(rows: Row[]): Row[] {
  let current = '';
  let last = '';
  return rows.map((row) => {
    const company = String(row.company ?? '')
      .trim()
      .toLowerCase();
    if (!current || company !== last) {
      current = newGroupId();
      last = company;
    }
    return { ...row, [GROUP_KEY]: current };
  });
}

export function blankWorkRow(group: string, company = ''): Row {
  return {
    title: '',
    company,
    startMonth: undefined,
    startYear: undefined,
    endMonth: undefined,
    endYear: undefined,
    isCurrent: false,
    description: '',
    proofAttachments: [],
    [GROUP_KEY]: group,
  };
}

export const newWorkGroup = newGroupId;

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const attachmentsOf = (row: Row): ProofAttachment[] =>
  Array.isArray(row.proofAttachments) ? (row.proofAttachments as ProofAttachment[]) : [];

function periodOf(roles: Row[]): string {
  const starts = roles.map((r) => r.startYear).filter((y): y is number => typeof y === 'number');
  if (starts.length === 0) return '';
  const current = roles.some((r) => r.isCurrent === true);
  const ends = roles.map((r) => r.endYear).filter((y): y is number => typeof y === 'number');
  const from = Math.min(...starts);
  const to = current ? 'Present' : ends.length ? String(Math.max(...ends)) : String(from);
  return `${from} – ${to}`;
}

const TRASH = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path
      d="M5 7h14M10 7V5h4v2m-7 0l1 12h8l1-12"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * The work-experience list, organised by company: the company name once, then its roles. Rows stay
 * a flat list underneath (each role carries the company name, as the API stores them); the group
 * key only decides which card a role is drawn in.
 */
export function WorkCompaniesEditor({
  rows,
  setRows,
  memberId,
  maxItems,
  dateErrors,
  dateWarnings,
  renderField,
  onError,
}: {
  rows: Row[];
  setRows: (updater: (prev: Row[]) => Row[]) => void;
  memberId: string;
  maxItems: number;
  dateErrors: Record<number, string>;
  dateWarnings: Record<number, string>;
  renderField: (spec: FieldSpec, row: Row, onChange: (key: string, value: unknown) => void) => ReactNode;
  onError: (message: string | null) => void;
}) {
  // Companies in the order their first role appears.
  const groupIds = [...new Set(rows.map((r) => String(r[GROUP_KEY])))];
  // Start with the only card open when there is just one (typically a brand-new blank one).
  const [open, setOpen] = useState<string | null>(groupIds.length === 1 ? groupIds[0] : null);
  const [confirm, setConfirm] = useState<string | null>(null); // `group` or `group:rowIndex`
  const roleFields = SECTION_CONFIG.work_experiences.fields.filter((f) => f.key !== 'company');
  const atCap = rows.length >= maxItems;

  const updateRow = (index: number, key: string, value: unknown) =>
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [key]: value };
        // "I currently work here" has no end date.
        if (key === 'isCurrent' && value === true) {
          next.endMonth = undefined;
          next.endYear = undefined;
        }
        return next;
      })
    );
  const setCompany = (group: string, company: string) =>
    setRows((prev) => prev.map((r) => (r[GROUP_KEY] === group ? { ...r, company } : r)));

  function addRole(group: string) {
    const company = text(rows.find((r) => r[GROUP_KEY] === group)?.company);
    setRows((prev) => {
      const lastIndex = prev.map((r) => r[GROUP_KEY]).lastIndexOf(group);
      const next = [...prev];
      next.splice(lastIndex + 1, 0, blankWorkRow(group, company));
      return next;
    });
  }
  function addCompany() {
    const id = newGroupId();
    setRows((prev) => [...prev, blankWorkRow(id)]);
    setOpen(id);
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {groupIds.map((group) => {
          const entries = rows.map((row, index) => ({ row, index })).filter((e) => e.row[GROUP_KEY] === group);
          const company = text(entries[0].row.company);
          const expanded = open === group;
          const incomplete = !company || entries.some((e) => !text(e.row.title) || typeof e.row.startYear !== 'number');
          return (
            <li key={group} className="rounded-2xl border border-line bg-bg-card">
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : group)}
                  aria-expanded={expanded}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{company || 'New company'}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {[
                        entries.length > 1 ? `${entries.length} roles` : text(entries[0].row.title),
                        periodOf(entries.map((e) => e.row)),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {incomplete && !expanded && (
                    <span className="flex-none rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">
                      Needs details
                    </span>
                  )}
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                    className={`flex-none text-ink-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
                  >
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {confirm === group ? (
                  <span className="flex flex-none items-center gap-2 text-xs text-ink-2">
                    Remove company?
                    <button
                      type="button"
                      onClick={() => {
                        setRows((prev) => prev.filter((r) => r[GROUP_KEY] !== group));
                        setConfirm(null);
                      }}
                      className="font-semibold text-error underline"
                    >
                      Yes
                    </button>
                    <button type="button" onClick={() => setConfirm(null)} className="font-medium text-ink-3">
                      No
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirm(group)}
                    aria-label={`Remove ${company || 'this company'}`}
                    className="flex-none rounded-md p-1.5 text-ink-3 transition-colors hover:bg-black/5 hover:text-error"
                  >
                    {TRASH}
                  </button>
                )}
              </div>

              {expanded && (
                <div className="flex flex-col gap-5 border-t border-line px-4 pb-4 pt-4">
                  <Input
                    label="Company"
                    markRequired
                    placeholder="M2K Advisors"
                    maxLength={300}
                    value={String(entries[0].row.company ?? '')}
                    onChange={(e) => setCompany(group, e.target.value)}
                  />
                  {entries.map(({ row, index }, k) => (
                    <div
                      key={index}
                      className={
                        entries.length > 1 || k > 0
                          ? 'flex flex-col gap-4 border-t border-line pt-5'
                          : 'flex flex-col gap-4'
                      }
                    >
                      {entries.length > 1 && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-ink-3">Role {k + 1}</span>
                          {confirm === `${group}:${index}` ? (
                            <span className="flex items-center gap-2 text-xs text-ink-2">
                              Remove role?
                              <button
                                type="button"
                                onClick={() => {
                                  setRows((prev) => prev.filter((_, i) => i !== index));
                                  setConfirm(null);
                                }}
                                className="font-semibold text-error underline"
                              >
                                Yes
                              </button>
                              <button type="button" onClick={() => setConfirm(null)} className="font-medium text-ink-3">
                                No
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirm(`${group}:${index}`)}
                              aria-label={`Remove role ${k + 1}`}
                              className="rounded-md p-1.5 text-ink-3 transition-colors hover:bg-black/5 hover:text-error"
                            >
                              {TRASH}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
                        {roleFields.map((spec) => (
                          <div
                            key={spec.key}
                            className={spec.span === 'half' && spec.key !== 'title' ? '' : 'sm:col-span-2'}
                          >
                            {renderField(spec, row, (key, value) => updateRow(index, key, value))}
                          </div>
                        ))}
                      </div>
                      {dateErrors[index] && (
                        <p role="alert" className="text-xs text-error">
                          {dateErrors[index]}
                        </p>
                      )}
                      {!dateErrors[index] && dateWarnings[index] && <WarningNote>{dateWarnings[index]}</WarningNote>}
                    </div>
                  ))}
                  {!atCap && (
                    <button
                      type="button"
                      onClick={() => addRole(group)}
                      className="self-start text-sm font-medium text-accent hover:underline"
                    >
                      + Add another role at {company || 'this company'}
                    </button>
                  )}
                  {/* Proof is for the company as a whole; it is kept on the company's first role. */}
                  <ProofAttachments
                    memberId={memberId}
                    examples={PROOF_EXAMPLES.work_experiences}
                    attachments={attachmentsOf(entries[0].row)}
                    onChange={(next) => updateRow(entries[0].index, 'proofAttachments', next)}
                    onError={onError}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!atCap ? (
        <button
          type="button"
          onClick={addCompany}
          className="rounded-2xl border-[1.5px] border-dashed border-line-2 px-5 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent"
        >
          + Add {groupIds.length === 0 ? 'a' : 'another'} company
        </button>
      ) : (
        <p className="text-xs text-ink-3">That is the maximum of {maxItems} roles.</p>
      )}
    </>
  );
}
