'use client';

import { useId, useRef, useState } from 'react';
import { Modal, Input, MonthYearField, Textarea, Button, YearPicker } from '@/components/ui';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { ImageCropper } from '@/components/ui/ImageCropper';
import { WarningNote } from '@/components/ui/WarningNote';
import { ProofAttachments } from '@/components/members/edit/ProofAttachments';
import {
  GROUP_KEY,
  WorkCompaniesEditor,
  blankWorkRow,
  newWorkGroup,
  withCompanyGroups,
} from '@/components/members/edit/WorkCompaniesEditor';
import { sortWorkHistory, workHistoryErrors, workHistoryWarnings } from '@/lib/members/work-history-check';
import {
  EMPTY_ROW,
  ITEM_NOUN,
  KEY_CLIENTS_MAX,
  PROOF_EXAMPLES,
  SECTION_CONFIG,
  SECTION_TITLES,
  type FieldSpec,
} from '@/components/members/edit/sectionFieldConfig';
import { requestMemberUpload, saveMemberSection } from '@/lib/api/members';
import { uploadToSignedUrl } from '@/lib/api/upload';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import type { MemberDto, MemberEditSection, ProofAttachment } from '@shared/member';

type Row = Record<string, unknown>;

/**
 * What the modal edits: a whole section, or (list sections) one entry — `itemId` 'new' adds one.
 * A list section with no `itemId` opens the whole list: edit, remove, add and reorder in one panel.
 */
export interface EditTarget {
  section: MemberEditSection;
  itemId?: string;
}

function attachmentsOf(row: Row): ProofAttachment[] {
  return Array.isArray(row.proofAttachments) ? (row.proofAttachments as ProofAttachment[]) : [];
}

function isFilled(value: unknown): boolean {
  return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
}

// Submit isn't a native form submit, so required-field completeness is checked explicitly.
function missingRequired(section: MemberEditSection, row: Row): boolean {
  // A month-year field is required through its year (the month is always optional).
  const required = SECTION_CONFIG[section].fields
    .filter((f) => f.required)
    .map((f) => (f.type === 'month-year' ? f.yearKey : f.key));
  if (required.some((key) => !isFilled(row[key]))) return true;
  // A client is required unless it is kept confidential.
  if (section === 'engagements' && row.isConfidential !== true && !isFilled(row.clientName)) return true;
  return false;
}

// The live entries of a list section, in the shape the API takes back (no isVerified — it's
// server-owned). Untouched entries are resent exactly as they are, so a save only changes what the
// member edited.
export function liveRows(member: MemberDto, section: MemberEditSection): Row[] {
  const withProof = <T extends { proofAttachments?: ProofAttachment[] }>(items: T[]) =>
    items.map((item) => ({ ...item, proofAttachments: item.proofAttachments ?? [] }));
  switch (section) {
    case 'engagements':
      return withProof(
        member.engagements.map(
          ({
            isVerified: _v,
            changedAt: _c,
            verifiedAt: _va,
            organization: _o,
            verificationMethods: _m,
            verificationMethodOther: _mo,
            ...rest
          }) => ({
            ...rest,
            clientName: rest.clientName ?? '',
          })
        )
      );
    case 'education':
      return withProof(member.educations.map(({ isVerified: _v, changedAt: _c, verifiedAt: _va, ...rest }) => rest));
    case 'work_experiences':
      return withProof(
        sortWorkHistory(
          member.workExperiences.map(({ isVerified: _v, changedAt: _c, verifiedAt: _va, ...rest }) => rest)
        )
      );
    case 'key_clients':
      // Carried through unchanged unless a new logo file is uploaded.
      return member.keyClients.map((c) => ({
        id: c.id,
        name: c.name,
        logoUrl: c.logoUrl,
        logoUploadPath: undefined,
        proofAttachments: c.proofAttachments ?? [],
      }));
    case 'testimonials':
      return withProof(
        member.testimonials.map(
          ({ isVerified: _v, changedAt: _c, verifiedAt: _va, serviceName: _s, occurredOn: _o, ...rest }) => rest
        )
      );
    case 'awards':
      return withProof(member.awards.map(({ isVerified: _v, changedAt: _c, verifiedAt: _va, ...rest }) => rest));
    default:
      return [];
  }
}

function fieldsInitial(member: MemberDto, section: MemberEditSection): Row {
  if (section === 'headline_bio') return { headline: member.headline ?? '', bio: member.bio ?? '' };
  return {
    workEmail: member.workEmail ?? '',
    contactPhone: member.contactPhone ?? '',
    linkedinUrl: member.linkedinUrl ?? '',
    website: member.website ?? '',
  };
}

// Strips UI-only keys; sorts work history newest-first.
function cleanRows(section: MemberEditSection, rows: Row[]): Row[] {
  const cleaned = rows.map((row) => {
    const { logoPreview: _p, [GROUP_KEY]: _g, ...rest } = row;
    return rest;
  });
  return section === 'work_experiences' ? sortWorkHistory(cleaned) : cleaned;
}

// A short label for an entry in the collapsed summary of the "Add one more" editor.
function entryLabel(section: MemberEditSection, row: Row): string {
  const text = (key: string) => (typeof row[key] === 'string' ? (row[key] as string).trim() : '');
  switch (section) {
    case 'education':
      return [text('degree'), text('institution')].filter(Boolean).join(' · ');
    case 'work_experiences':
      return [text('title'), text('company')].filter(Boolean).join(' · ');
    case 'testimonials':
      return text('clientName');
    default:
      return text('title');
  }
}

function Field({
  spec,
  row,
  onChange,
}: {
  spec: FieldSpec;
  row: Row;
  /** Sets one payload key — most fields write `spec.key`; a month-year field writes two keys. */
  onChange: (key: string, value: unknown) => void;
}) {
  const value = row[spec.key];
  const flagId = useId();
  if (spec.type === 'text-flag') {
    const flagged = Boolean(row[spec.flagKey]);
    // Two columns: the text field and a small tick, centred on the field's line; underneath, the hint
    // on the left and the tick's word centred under the box. The tick stays beside the field on
    // phones too.
    return (
      <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1.5">
        <div className="min-w-0">
          <Input
            label={spec.label}
            placeholder={spec.placeholder}
            maxLength={300}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(spec.key, e.target.value)}
          />
        </div>
        <div className="flex flex-col items-center justify-end self-end">
          <label htmlFor={flagId} className="relative flex h-[46px] w-8 cursor-pointer items-center justify-center">
            <input
              id={flagId}
              type="checkbox"
              checked={flagged}
              onChange={(e) => onChange(spec.flagKey, e.target.checked)}
              className="peer sr-only"
            />
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line-2 bg-bg-card text-transparent transition-colors hover:border-ink-3 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-bg-card peer-focus-visible:ring-[3px] peer-focus-visible:ring-ink/[0.08]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5 12.5l4.5 4.5L19 7"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </label>
        </div>
        <p className="text-xs text-ink-3">{flagged ? spec.flagHint : spec.hint}</p>
        <label htmlFor={flagId} className="cursor-pointer text-center text-[11px] font-medium leading-snug text-ink-2">
          {spec.flagLabel}
        </label>
      </div>
    );
  }
  if (spec.type === 'month-year') {
    return (
      <MonthYearField
        label={spec.label}
        required={spec.required}
        disabled={spec.disabledWhenKey ? Boolean(row[spec.disabledWhenKey]) : false}
        month={row[spec.monthKey] as number | undefined}
        year={row[spec.yearKey] as number | undefined}
        onMonthChange={(m) => onChange(spec.monthKey, m)}
        onYearChange={(y) => onChange(spec.yearKey, y)}
      />
    );
  }
  if (spec.type === 'textarea') {
    return (
      <Textarea
        label={spec.label}
        markRequired={spec.required}
        hint={spec.hint}
        placeholder={spec.placeholder}
        rows={3}
        maxLength={2000}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(spec.key, e.target.value)}
      />
    );
  }
  if (spec.type === 'checkbox') {
    // A tappable card: the whole row toggles, and it lights up when ticked.
    return (
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-bg-card p-3.5 transition-colors hover:border-ink-3 has-[:checked]:border-accent has-[:checked]:bg-[color-mix(in_oklab,var(--accent)_6%,transparent)]">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(spec.key, e.target.checked)}
          className="mt-0.5 h-4 w-4 flex-none accent-[var(--accent)]"
        />
        <span>
          <span className="block text-sm font-medium text-ink">{spec.label}</span>
          {spec.hint && <span className="mt-0.5 block text-xs text-ink-3">{spec.hint}</span>}
        </span>
      </label>
    );
  }
  if (spec.type === 'year') {
    return (
      <YearPicker
        label={spec.label}
        markRequired={spec.required}
        yearsAhead={spec.yearsAhead}
        value={typeof value === 'number' ? value : undefined}
        onChange={(year) => onChange(spec.key, year)}
      />
    );
  }
  if (spec.type === 'number') {
    return (
      <Input
        label={spec.label}
        type="number"
        inputMode="numeric"
        markRequired={spec.required}
        hint={spec.hint}
        placeholder={spec.placeholder}
        min={spec.min}
        max={spec.max}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(spec.key, e.target.value ? Number(e.target.value) : undefined)}
      />
    );
  }
  return (
    <Input
      label={spec.label}
      type={spec.type}
      markRequired={spec.required}
      hint={spec.hint}
      placeholder={spec.placeholder}
      maxLength={300}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(spec.key, e.target.value)}
    />
  );
}

export function SectionEditModal({
  member,
  target,
  onClose,
  onSaved,
}: {
  member: MemberDto;
  target: EditTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<Row>({});
  // Rows being edited: one entry for an item edit, every client for the key-clients list.
  const [rows, setRows] = useState<Row[]>([]);
  // Which entry is expanded when several are being added in one go (the others show a summary).
  const [openIndex, setOpenIndex] = useState(0);
  // Drag-to-reorder (list mode): the row being dragged, and each row's element for hit-testing.
  const [dragging, setDragging] = useState<number | null>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // List mode: the entry whose removal is awaiting confirmation.
  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingCrop, setPendingCrop] = useState<{ rowIndex: number; file: File } | null>(null);

  // Reset local state whenever a different target is opened.
  const targetKey = target ? `${target.section}:${target.itemId ?? ''}` : null;
  const [openedKey, setOpenedKey] = useState<string | null>(null);
  if (target && targetKey !== openedKey) {
    setOpenedKey(targetKey);
    const config = SECTION_CONFIG[target.section];
    setError(null);
    setPendingCrop(null);
    setConfirmDelete(false);
    setConfirmRemove(null);
    setOpenIndex(0);
    if (config.shape === 'fields') {
      setFields(fieldsInitial(member, target.section));
      setRows([]);
    } else if (config.shape === 'clients') {
      const live = liveRows(member, target.section);
      setRows(live.length ? live : [{ ...EMPTY_ROW.key_clients }]);
    } else if (!target.itemId) {
      // The whole list: every entry collapsed to a summary, or one blank entry when there are none.
      const live = liveRows(member, target.section);
      if (target.section === 'work_experiences') {
        setRows(live.length ? withCompanyGroups(live) : [blankWorkRow(newWorkGroup())]);
      } else {
        setRows(live.length ? live : [{ ...EMPTY_ROW[target.section] }]);
      }
      setOpenIndex(live.length ? -1 : 0);
    } else if (target.itemId && target.itemId !== 'new') {
      const existing = liveRows(member, target.section).find((r) => r.id === target.itemId);
      setRows([existing ?? { ...EMPTY_ROW[target.section] }]);
    } else {
      setRows([{ ...EMPTY_ROW[target.section] }]);
    }
  }

  if (!target) return null;
  const { section, itemId } = target;
  const config = SECTION_CONFIG[section];
  const isFieldsMode = config.shape === 'fields';
  const isClients = config.shape === 'clients';
  const isList = config.shape === 'items' && !itemId;
  const isNew = config.shape === 'items' && itemId === 'new';
  const noun = ITEM_NOUN[section] ?? 'entry';
  const liveList = isFieldsMode || isClients || isList ? [] : liveRows(member, section);
  const atCap = !isFieldsMode && !isClients && isNew && liveList.length >= (config.maxItems ?? Infinity);

  // The full list a save sends: the live entries with this editor's entries replaced / appended
  // (item mode), or every row (key clients). The editor can hold several new entries at once
  // ("Add one more"); when editing an existing entry, row 0 is that entry and the rest are new.
  function composed(): Row[] {
    if (isClients || isList) return rows;
    if (isNew) return [...liveList, ...rows];
    return [...liveList.map((r) => (r.id === itemId ? (rows[0] ?? r) : r)), ...rows.slice(1)];
  }
  // Where editor row `i` ends up in the composed list (for per-entry date checks).
  function composedIndex(i: number): number {
    if (isList) return i;
    if (isNew) return liveList.length + i;
    return i === 0 ? liveList.findIndex((r) => r.id === itemId) : liveList.length + i - 1;
  }
  const totalAfterSave = isList
    ? rows.length
    : isNew
      ? liveList.length + rows.length
      : liveList.length + rows.length - 1;
  const canAddMore = totalAfterSave < (config.maxItems ?? Infinity);

  function moveRow(from: number, to: number) {
    if (from === to || to < 0 || to >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  // Grab the handle and drag: the row follows the pointer by swapping with whichever row it is over.
  // Rows collapse first so they are all the same height and the swap doesn't jitter.
  function startDrag(e: ReactPointerEvent<HTMLButtonElement>, index: number) {
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    let current = index;
    setOpenIndex(-1);
    setDragging(index);
    const onMove = (ev: PointerEvent) => {
      const over = rowRefs.current.findIndex((el) => {
        const r = el?.getBoundingClientRect();
        return r !== undefined && ev.clientY >= r.top && ev.clientY <= r.bottom;
      });
      if (over >= 0 && over !== current) {
        moveRow(current, over);
        current = over;
        setDragging(over);
      }
    };
    const end = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      setDragging(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function updateRow(index: number, key: string, value: unknown) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row, [key]: value };
        // "I currently work here" has no end date: drop any that was set.
        if (key === 'isCurrent' && value === true) {
          next.endMonth = undefined;
          next.endYear = undefined;
        }
        return next;
      })
    );
  }

  const fullList = isFieldsMode ? [] : composed();
  const dateErrors: Record<number, string> = section === 'work_experiences' ? workHistoryErrors(fullList) : {};
  const dateWarnings: Record<number, string> = section === 'work_experiences' ? workHistoryWarnings(fullList) : {};
  const hasDateErrors = Object.keys(dateErrors).length > 0;
  const incomplete = isFieldsMode
    ? config.fields.some((f) => f.required && !isFilled(fields[f.key]))
    : rows.some((row) => missingRequired(section, row));
  const canSave = !incomplete && !hasDateErrors && !submitting && !atCap;

  // Uploads immediately per row, not deferred to save.
  async function handleLogoUpload(rowIndex: number, file: File) {
    setError(null);
    try {
      const { uploadUrl, path } = await requestMemberUpload(member.id, file);
      await uploadToSignedUrl(uploadUrl, file);
      setRows((prev) =>
        prev.map((row, i) =>
          i === rowIndex ? { ...row, logoUploadPath: path, logoPreview: URL.createObjectURL(file) } : row
        )
      );
    } catch (err) {
      setError(apiErrorMessage(err, 'Logo upload failed. Please try again.'));
    }
  }

  async function submit(payload: unknown) {
    setSubmitting(true);
    setError(null);
    try {
      await saveMemberSection(member.id, section, payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  const title = isFieldsMode || isClients || isList ? SECTION_TITLES[section] : `${isNew ? 'New' : 'Edit'} ${noun}`;
  // Short fields sit two to a row from 640px up; everything else takes the full width.
  const fieldGrid = (row: Row, onChange: (key: string, value: unknown) => void) => (
    <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
      {config.fields.map((spec) => (
        <div key={spec.key} className={spec.span === 'half' ? '' : 'sm:col-span-2'}>
          <Field spec={spec} row={row} onChange={onChange} />
        </div>
      ))}
    </div>
  );

  return (
    <Modal open onClose={onClose} title={title} size="lg">
      <div className="flex flex-col gap-5">
        {isFieldsMode && fieldGrid(fields, (key, value) => setFields((prev) => ({ ...prev, [key]: value })))}

        {!isFieldsMode && atCap && (
          <p className="text-sm text-ink-3">
            You have reached the maximum of {config.maxItems} {noun}s. Remove one to add another.
          </p>
        )}

        {/* Key clients: one compact card per client — logo on the left, name on the right. */}
        {isClients && !atCap && (
          <>
            <ul className="flex flex-col gap-3">
              {rows.map((row, i) => (
                <li key={i} className="rounded-2xl border border-line bg-bg-card p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-none flex-col items-center gap-1.5">
                      <label
                        htmlFor={`logo-${i}`}
                        className="group relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-[1.5px] border-dashed border-line-2 bg-bg-alt text-ink-3 transition-colors hover:border-accent hover:text-accent focus-within:ring-[3px] focus-within:ring-ink/[0.08]"
                      >
                        {/* Raw <img>: a blob:/data: preview of the picked file, or a member-entered logo URL on any host. */}
                        {typeof row.logoPreview === 'string' ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.logoPreview} alt="" className="h-full w-full object-cover" />
                        ) : typeof row.logoUrl === 'string' && !row.logoUploadPath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={row.logoUrl} alt="" className="h-full w-full object-contain" />
                        ) : (
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M4 8a2 2 0 012-2h1.5l1-1.5h7L17.5 6H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
                              stroke="currentColor"
                              strokeWidth="1.6"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="1.6" />
                          </svg>
                        )}
                        <input
                          id={`logo-${i}`}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setPendingCrop({ rowIndex: i, file });
                            e.target.value = '';
                          }}
                          className="sr-only"
                        />
                      </label>
                      <span className="text-[11px] text-ink-3">
                        {row.logoUploadPath ? 'Logo added' : 'Logo (optional)'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <Field spec={config.fields[0]} row={row} onChange={(key, value) => updateRow(i, key, value)} />
                    </div>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}
                        aria-label="Remove this client"
                        className="mt-6 flex-none rounded-md p-1.5 text-ink-3 transition-colors hover:bg-black/5 hover:text-error"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M5 7h14M10 7V5h4v2m-7 0l1 12h8l1-12"
                            stroke="currentColor"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                  <details className="group mt-3">
                    <summary className="cursor-pointer list-none text-xs font-medium text-ink-3 hover:text-ink [&::-webkit-details-marker]:hidden">
                      + Add proof to get this client verified faster (optional)
                      {attachmentsOf(row).length > 0 ? ` · ${attachmentsOf(row).length} attached` : ''}
                    </summary>
                    <div className="mt-2">
                      <ProofAttachments
                        memberId={member.id}
                        examples={PROOF_EXAMPLES.key_clients}
                        attachments={attachmentsOf(row)}
                        onChange={(next) => updateRow(i, 'proofAttachments', next)}
                        onError={setError}
                      />
                    </div>
                  </details>
                </li>
              ))}
            </ul>
            {rows.length < KEY_CLIENTS_MAX && (
              <button
                type="button"
                onClick={() => setRows([...rows, { ...EMPTY_ROW.key_clients }])}
                className="rounded-2xl border-[1.5px] border-dashed border-line-2 px-5 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent"
              >
                + Add another client{' '}
                <span className="font-normal text-ink-3">
                  ({rows.length} of {KEY_CLIENTS_MAX})
                </span>
              </button>
            )}
            <p className="text-xs text-ink-3">
              We may call or email a client to confirm the relationship, so list only clients you worked with directly.
            </p>
          </>
        )}

        {/* The entries of a list section (engagement, role, award, …). One is shown flat; once the
            member adds more, each becomes a collapsible card and only the open one shows its form. */}
        {isList && section === 'work_experiences' && (
          <WorkCompaniesEditor
            rows={rows}
            setRows={setRows}
            memberId={member.id}
            maxItems={config.maxItems ?? 15}
            dateErrors={dateErrors}
            dateWarnings={dateWarnings}
            renderField={(spec, row, onChange) => <Field spec={spec} row={row} onChange={onChange} />}
            onError={setError}
          />
        )}

        {!isFieldsMode &&
          !isClients &&
          !atCap &&
          !(isList && section === 'work_experiences') &&
          (rows.length > 0 || isList) && (
            <>
              {rows.map((row, i) => {
                const expanded = (!isList && rows.length === 1) || i === openIndex;
                const at = composedIndex(i);
                const form = (
                  <div className="flex flex-col gap-4">
                    {fieldGrid(row, (key, value) => updateRow(i, key, value))}
                    {dateErrors[at] && (
                      <p role="alert" className="text-xs text-error">
                        {dateErrors[at]}
                      </p>
                    )}
                    {!dateErrors[at] && dateWarnings[at] && <WarningNote>{dateWarnings[at]}</WarningNote>}
                    <ProofAttachments
                      memberId={member.id}
                      examples={PROOF_EXAMPLES[section]}
                      attachments={attachmentsOf(row)}
                      onChange={(next) => updateRow(i, 'proofAttachments', next)}
                      onError={setError}
                    />
                  </div>
                );
                if (!isList && rows.length === 1) return <div key={i}>{form}</div>;
                const incompleteRow = missingRequired(section, row);
                // The first row of an existing-entry edit is removed with the link under Save, not here.
                const removable = isList || isNew || i > 0;
                const reorderable = isList && section !== 'work_experiences' && rows.length > 1;
                return (
                  <div
                    key={i}
                    ref={(el) => {
                      rowRefs.current[i] = el;
                    }}
                    className={`rounded-2xl border bg-bg-card transition-shadow ${
                      dragging === i ? 'border-accent shadow-[0_8px_24px_rgba(0,0,0,0.12)]' : 'border-line'
                    }`}
                  >
                    <div className="flex items-center gap-2 px-4 py-3">
                      {reorderable && (
                        <button
                          type="button"
                          data-handle={i}
                          aria-label={`Reorder ${noun} ${i + 1}. Drag, or use the up and down arrow keys.`}
                          onPointerDown={(e) => startDrag(e, i)}
                          onKeyDown={(e) => {
                            const to = e.key === 'ArrowUp' ? i - 1 : e.key === 'ArrowDown' ? i + 1 : null;
                            if (to === null) return;
                            e.preventDefault();
                            moveRow(i, to);
                            // The rows re-render in their new order; put focus back on the moved row's handle.
                            requestAnimationFrame(() =>
                              document.querySelector<HTMLButtonElement>(`[data-handle="${to}"]`)?.focus()
                            );
                          }}
                          className="-ml-1.5 flex h-8 w-6 flex-none cursor-grab touch-none items-center justify-center rounded-md text-ink-4 transition-colors hover:bg-black/5 hover:text-ink-2 active:cursor-grabbing"
                        >
                          <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true">
                            {[3, 9].flatMap((x) =>
                              [3, 9, 15].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />)
                            )}
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpenIndex(isList && expanded ? -1 : i)}
                        aria-expanded={expanded}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      >
                        {!reorderable && (
                          <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-bg-alt font-mono text-[11px] font-semibold text-ink-2">
                            {i + 1}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                          {entryLabel(section, row) || `New ${noun}`}
                        </span>
                        {incompleteRow && !expanded && (
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
                      {removable &&
                        (isList && confirmRemove === i ? (
                          <span className="flex flex-none items-center gap-2 text-xs text-ink-2">
                            Remove?
                            <button
                              type="button"
                              onClick={() => {
                                setRows(rows.filter((_, j) => j !== i));
                                setOpenIndex(-1);
                                setConfirmRemove(null);
                              }}
                              className="font-semibold text-error underline"
                            >
                              Yes
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(null)}
                              className="font-medium text-ink-3"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (isList) {
                                setConfirmRemove(i);
                                return;
                              }
                              setRows(rows.filter((_, j) => j !== i));
                              setOpenIndex(Math.max(0, i - 1));
                            }}
                            aria-label={`Remove ${noun} ${i + 1}`}
                            className="flex-none rounded-md p-1.5 text-ink-3 transition-colors hover:bg-black/5 hover:text-error"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path
                                d="M5 7h14M10 7V5h4v2m-7 0l1 12h8l1-12"
                                stroke="currentColor"
                                strokeWidth="1.7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        ))}
                    </div>
                    {expanded && <div className="border-t border-line px-4 pb-4 pt-4">{form}</div>}
                  </div>
                );
              })}
              {canAddMore ? (
                <button
                  type="button"
                  onClick={() => {
                    setRows([...rows, { ...EMPTY_ROW[section] }]);
                    // The new entry opens; the one before it collapses to its summary.
                    setOpenIndex(rows.length);
                  }}
                  className="rounded-2xl border-[1.5px] border-dashed border-line-2 px-5 py-3 text-sm font-medium text-ink-2 transition-colors hover:border-accent hover:text-accent"
                >
                  {isList ? `+ Add ${rows.length === 0 ? 'a' : 'another'} ${noun}` : `+ Add one more ${noun}`}
                </button>
              ) : (
                <p className="text-xs text-ink-3">
                  That is the maximum of {config.maxItems} {noun}s.
                </p>
              )}
            </>
          )}

        {error && (
          <div role="alert" className="rounded-input border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Stays in view while a long form scrolls. */}
        <div className="sticky -bottom-6 -mx-6 -mb-6 border-t border-line bg-bg-card px-6 pb-5 pt-4 max-[640px]:-bottom-5 max-[640px]:-mx-5 max-[640px]:-mb-5 max-[640px]:px-5">
          <Button
            onClick={() => submit(isFieldsMode ? fields : cleanRows(section, fullList))}
            disabled={!canSave}
            fullWidth
          >
            {submitting
              ? 'Saving…'
              : !isFieldsMode && !isClients && !isList && rows.length > 1
                ? `Save ${rows.length} ${noun}s`
                : 'Save'}
          </Button>
          <p className="mt-2.5 flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-none">
              <path
                d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.500-7-10V6l7-3z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
            {section === 'headline_bio'
              ? 'Goes live on your profile straight away.'
              : 'Goes live straight away, marked Pending Verification until the GrowXQ team checks it.'}
          </p>
          {!isFieldsMode && !isClients && !isNew && !isList && (
            <div className="mt-2 text-center">
              {confirmDelete ? (
                <span className="text-sm text-ink-2">
                  Remove this {noun}?{' '}
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() =>
                      submit(
                        cleanRows(
                          section,
                          liveList.filter((r) => r.id !== itemId)
                        )
                      )
                    }
                    className="font-semibold text-error underline"
                  >
                    Yes, remove
                  </button>{' '}
                  <button type="button" onClick={() => setConfirmDelete(false)} className="font-medium text-ink-3">
                    Cancel
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="text-sm font-medium text-error hover:underline"
                >
                  Remove this {noun}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {pendingCrop && (
        <ImageCropper
          file={pendingCrop.file}
          onCancel={() => setPendingCrop(null)}
          onConfirm={(cropped) => {
            const { rowIndex } = pendingCrop;
            setPendingCrop(null);
            void handleLogoUpload(rowIndex, cropped);
          }}
        />
      )}
    </Modal>
  );
}
