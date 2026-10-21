'use client';

import { useState } from 'react';
import { Modal, Input, Textarea, Button } from '@/components/ui';
import { ImageCropper } from '@/components/ui/ImageCropper';
import { sortWorkHistory, workHistoryErrors, workHistoryWarnings } from '@/lib/members/work-history-check';
import {
  EMPTY_ROW,
  KEY_CLIENTS_MAX,
  VERIFICATION_METHOD_OPTIONS,
  SECTION_CONFIG,
  SECTION_TITLES,
  type FieldSpec,
  type SectionConfig,
} from '@/components/members/edit/sectionFieldConfig';
import { createMemberEdit, requestMemberUpload } from '@/lib/api/members';
import { uploadToSignedUrl } from '@/lib/api/upload';
import { ApiError } from '@/lib/api/client';
import type { CreateMemberEditRequest, MemberDto, MemberEditSection, ProofAttachment } from '@shared/member';

type Row = Record<string, unknown>;

// Sections whose proof is embedded per row (payload[i].proofAttachments) rather than shared
// across the whole batch via the modal-level proofFileUrl/proofLink fields.
function hasPerItemProof(config: SectionConfig): boolean {
  return config.shape === 'list-per-item-proof' || config.shape === 'clients';
}

function rowAttachments(row: Row): ProofAttachment[] {
  return Array.isArray(row.proofAttachments) ? (row.proofAttachments as ProofAttachment[]) : [];
}

// Submit isn't a native form submit, so required-field completeness is checked explicitly.
function hasRequiredFieldsFilled(config: SectionConfig, data: Row | Row[]): boolean {
  const rows = Array.isArray(data) ? data : [data];
  const requiredKeys = config.fields
    .filter((f) => 'required' in f && f.required)
    .map((f) => f.key);
  return rows.every((row) =>
    requiredKeys.every((key) => {
      const value = row[key];
      return typeof value === 'string' ? value.trim().length > 0 : value !== undefined && value !== null;
    })
  );
}

function initialPayload(member: MemberDto, section: MemberEditSection): Row | Row[] {
  switch (section) {
    case 'headline_bio':
      return { headline: member.headline ?? '', bio: member.bio ?? '' };
    case 'contact':
      return {
        contactEmail: member.contactEmail ?? '',
        workEmail: member.workEmail ?? '',
        contactPhone: member.contactPhone ?? '',
        linkedinUrl: member.linkedinUrl ?? '',
        website: member.website ?? '',
      };
    case 'engagements':
      return member.engagements.length
        ? member.engagements.map(({ isVerified: _v, clientName, clientEmail, verificationMethodOther, ...rest }) => ({
            ...rest,
            clientName: clientName ?? '',
            clientEmail: clientEmail ?? '',
            verificationMethodOther: verificationMethodOther ?? '',
            proofAttachments: rest.proofAttachments ?? [],
          }))
        : [{ ...EMPTY_ROW.engagements }];
    case 'education':
      return member.educations.length
        ? member.educations.map(({ isVerified: _v, ...rest }) => rest)
        : [{ ...EMPTY_ROW.education }];
    case 'work_experiences':
      return member.workExperiences.length
        ? sortWorkHistory(member.workExperiences.map(({ isVerified: _v, ...rest }) => rest))
        : [{ ...EMPTY_ROW.work_experiences }];
    case 'key_clients':
      // Carried through unchanged unless a new file is uploaded.
      return member.keyClients.length
        ? member.keyClients.map((c) => ({
            id: c.id,
            name: c.name,
            logoUrl: c.logoUrl,
            logoUploadPath: undefined,
            proofAttachments: c.proofAttachments ?? [],
          }))
        : [{ ...EMPTY_ROW.key_clients }];
    case 'testimonials':
      return member.testimonials.length
        ? member.testimonials.map(({ isVerified: _v, ...rest }) => ({
            ...rest,
            clientEmail: rest.clientEmail ?? '',
            proofAttachments: rest.proofAttachments ?? [],
          }))
        : [{ ...EMPTY_ROW.testimonials }];
    case 'awards':
      return member.awards.length
        ? member.awards.map(({ isVerified: _v, ...rest }) => ({ ...rest, proofAttachments: rest.proofAttachments ?? [] }))
        : [{ ...EMPTY_ROW.awards }];
  }
}

// Strips UI-only keys and blank optional values before submit; sorts work history newest-first.
function cleanPayload(section: MemberEditSection, data: Row | Row[]): Row | Row[] {
  if (!Array.isArray(data)) return data;
  const rows = data.map((row) => {
    const { logoPreview: _p, ...rest } = row;
    const out: Row = { ...rest };
    if ((section === 'engagements' || section === 'testimonials') && typeof out.clientEmail === 'string' && !out.clientEmail.trim()) {
      delete out.clientEmail;
    }
    if (section === 'engagements') {
      const methods = Array.isArray(out.verificationMethods) ? (out.verificationMethods as string[]) : [];
      if (!methods.includes('other') || !String(out.verificationMethodOther ?? '').trim()) {
        delete out.verificationMethodOther;
      }
    }
    return out;
  });
  return section === 'work_experiences' ? sortWorkHistory(rows) : rows;
}

function VerificationMethods({
  row,
  onChange,
}: {
  row: Row;
  onChange: (key: string, value: unknown) => void;
}) {
  const selected = Array.isArray(row.verificationMethods) ? (row.verificationMethods as string[]) : [];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium text-ink-2">How can this engagement be verified?</legend>
      <div className="flex flex-col gap-1.5">
        {VERIFICATION_METHOD_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm text-ink-2">
            <input
              type="checkbox"
              checked={selected.includes(opt.value)}
              onChange={(e) =>
                onChange(
                  'verificationMethods',
                  e.target.checked ? [...selected, opt.value] : selected.filter((v) => v !== opt.value)
                )
              }
            />
            {opt.label}
          </label>
        ))}
      </div>
      {selected.includes('other') && (
        <Input
          label="Describe the other method"
          type="text"
          maxLength={300}
          value={String(row.verificationMethodOther ?? '')}
          onChange={(e) => onChange('verificationMethodOther', e.target.value)}
        />
      )}
    </fieldset>
  );
}

function Field({
  spec,
  value,
  onChange,
}: {
  spec: FieldSpec;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (spec.type === 'verification-methods') return null;
  if (spec.type === 'textarea') {
    return (
      <Textarea
        label={spec.label}
        required={spec.required}
        rows={3}
        maxLength={2000}
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (spec.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm text-ink-2">
        <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />
        {spec.label}
      </label>
    );
  }
  if (spec.type === 'number') {
    return (
      <Input
        label={spec.label}
        type="number"
        required={spec.required}
        min={spec.min}
        max={spec.max}
        value={value === undefined || value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
      />
    );
  }
  return (
    <Input
      label={spec.label}
      type={spec.type}
      required={spec.required}
      maxLength={300}
      value={(value as string) ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SectionEditModal({
  member,
  section,
  onClose,
  onSubmitted,
}: {
  member: MemberDto;
  section: MemberEditSection | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [data, setData] = useState<Row | Row[] | null>(null);
  const [proofMode, setProofMode] = useState<'file' | 'link'>('link');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofLink, setProofLink] = useState('');
  // Per-row link-being-typed text, for list-per-item-proof sections — kept out of `data` so it's
  // never accidentally submitted as part of the row payload.
  const [linkDrafts, setLinkDrafts] = useState<Record<number, string>>({});
  const [uploadingRow, setUploadingRow] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCrop, setPendingCrop] = useState<{ rowIndex: number; file: File } | null>(null);

  // Reset local state whenever a new section is opened.
  const [openedSection, setOpenedSection] = useState<MemberEditSection | null>(null);
  if (section && section !== openedSection) {
    setOpenedSection(section);
    setData(initialPayload(member, section));
    setProofMode('link');
    setProofFile(null);
    setProofLink('');
    setLinkDrafts({});
    setUploadingRow(null);
    setPendingCrop(null);
    setError(null);
  }

  if (!section || data === null) return null;

  // Keeps the non-null narrowing available inside nested closures below.
  const activeSection = section;

  const config = SECTION_CONFIG[section];
  // list-shared-proof (education, work_experiences): one proof for the whole batch, via the
  // modal-level widget below. list-per-item-proof (engagements, testimonials, awards): proof is
  // embedded per row, rendered inline with that row instead.
  const needsSharedProof = config.shape === 'list-shared-proof';
  const needsPerItemProof = hasPerItemProof(config);
  const rows = Array.isArray(data) ? data : null;

  function updateField(rowIndex: number | null, key: string, value: unknown) {
    if (rowIndex === null) {
      setData((prev) => ({ ...(prev as Row), [key]: value }));
    } else {
      setData((prev) => {
        const next = [...(prev as Row[])];
        next[rowIndex] = { ...next[rowIndex], [key]: value };
        return next;
      });
    }
  }

  function addRow() {
    if (!rows) return;
    setData([...rows, { ...EMPTY_ROW[activeSection] }]);
  }

  function removeRow(index: number) {
    if (!rows) return;
    setData(rows.filter((_, i) => i !== index));
  }

  // Proof is optional everywhere; without it an admin can still approve the item, just not
  // with the Verified badge.
  const dateErrors: Record<number, string> =
    activeSection === 'work_experiences' && rows ? workHistoryErrors(rows) : {};
  const dateWarnings: Record<number, string> =
    activeSection === 'work_experiences' && rows ? workHistoryWarnings(rows) : {};
  const hasDateErrors = Object.keys(dateErrors).length > 0;
  const atCap = rows !== null && rows.length >= (config.maxItems ?? Infinity);
  const canSubmit = hasRequiredFieldsFilled(config, data) && !hasDateErrors && !submitting;

  // Uploads immediately per row, not deferred to submit like proof files.
  async function handleLogoUpload(rowIndex: number, file: File) {
    setError(null);
    try {
      const { uploadUrl, path } = await requestMemberUpload(member.id, {
        fileName: file.name,
        contentType: file.type,
      });
      await uploadToSignedUrl(uploadUrl, file);
      updateField(rowIndex, 'logoUploadPath', path);
      updateField(rowIndex, 'logoPreview', URL.createObjectURL(file));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Logo upload failed. Please try again.');
    }
  }

  // A row can carry any mix of multiple files and links — each upload appends, never replaces.
  async function handleProofFilesSelected(rowIndex: number, files: FileList) {
    setError(null);
    setUploadingRow(rowIndex);
    try {
      const uploaded: ProofAttachment[] = [];
      for (const file of Array.from(files)) {
        const { uploadUrl, path } = await requestMemberUpload(member.id, {
          fileName: file.name,
          contentType: file.type,
        });
        await uploadToSignedUrl(uploadUrl, file);
        uploaded.push({ type: 'file', url: path, label: file.name });
      }
      updateField(rowIndex, 'proofAttachments', [...rowAttachments((rows as Row[])[rowIndex]), ...uploaded]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'File upload failed. Please try again.');
    } finally {
      setUploadingRow(null);
    }
  }

  function addLinkAttachment(rowIndex: number) {
    const url = (linkDrafts[rowIndex] ?? '').trim();
    if (!url) return;
    updateField(rowIndex, 'proofAttachments', [
      ...rowAttachments((rows as Row[])[rowIndex]),
      { type: 'link', url, label: url } satisfies ProofAttachment,
    ]);
    setLinkDrafts((prev) => ({ ...prev, [rowIndex]: '' }));
  }

  function removeAttachment(rowIndex: number, attachmentIndex: number) {
    updateField(
      rowIndex,
      'proofAttachments',
      rowAttachments((rows as Row[])[rowIndex]).filter((_, i) => i !== attachmentIndex)
    );
  }

  async function handleSubmit() {
    if (!section) return;
    setSubmitting(true);
    setError(null);
    try {
      let proofFileUrl: string | undefined;
      if (proofMode === 'file' && proofFile) {
        const { uploadUrl, path } = await requestMemberUpload(member.id, {
          fileName: proofFile.name,
          contentType: proofFile.type,
        });
        await uploadToSignedUrl(uploadUrl, proofFile);
        proofFileUrl = path;
      }

      const payload = cleanPayload(section, data as Row | Row[]);
      const body = {
        section,
        payload,
        ...(needsSharedProof
          ? { proofFileUrl, proofLink: proofMode === 'link' ? proofLink.trim() || undefined : undefined }
          : {}),
      } as CreateMemberEditRequest;

      await createMemberEdit(member.id, body);
      onSubmitted();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={SECTION_TITLES[section]}>
      <div className="flex flex-col gap-4">
        {rows ? (
          <>
            {activeSection === 'key_clients' && (
              <div className="rounded-xl border border-line bg-bg-alt p-3 text-xs text-ink-2">
                <p className="font-medium text-ink">Before you add key clients</p>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  <li>
                    We may randomly call or email a client to verify the relationship.
                  </li>
                  <li>
                    You must have worked with the client directly, not a generic client of the
                    organisation you did the work through.
                  </li>
                  <li>
                    Up to {KEY_CLIENTS_MAX} key clients ({rows.length} of {KEY_CLIENTS_MAX} used). Clients
                    with proof attached show as Verified.
                  </li>
                </ul>
              </div>
            )}
            {rows.map((row, i) => (
              <div key={i} className="rounded-xl border border-line p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-mono-label text-ink-3">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="text-xs font-medium text-error"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  {config.fields.map((spec) =>
                    spec.type === 'verification-methods' ? (
                      <VerificationMethods
                        key={spec.key}
                        row={row}
                        onChange={(key, value) => updateField(i, key, value)}
                      />
                    ) : (
                      <Field
                        key={spec.key}
                        spec={spec}
                        value={row[spec.key]}
                        onChange={(value) => updateField(i, spec.key, value)}
                      />
                    )
                  )}
                  {dateErrors[i] && (
                    <p role="alert" className="text-xs text-error">
                      {dateErrors[i]}
                    </p>
                  )}
                  {!dateErrors[i] && dateWarnings[i] && <p className="text-xs text-amber-700">{dateWarnings[i]}</p>}
                </div>
                {config.shape === 'clients' && (
                  <div className="mt-3">
                    {typeof row.logoPreview === 'string' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.logoPreview} alt="" className="mb-2 h-16 w-16 rounded-input object-cover" />
                    ) : typeof row.logoUrl === 'string' && !row.logoUploadPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.logoUrl} alt="" className="mb-2 h-16 w-16 rounded-input object-contain" />
                    ) : null}
                    <label className="text-xs font-medium text-ink-2">Logo (cropped to a square)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setPendingCrop({ rowIndex: i, file });
                        e.target.value = '';
                      }}
                      className="mt-1 block text-sm"
                    />
                    {row.logoUploadPath ? (
                      <p className="mt-1 text-xs text-ok">New logo cropped and uploaded.</p>
                    ) : null}
                  </div>
                )}
                {needsPerItemProof && (
                  <div className="mt-3 rounded-xl border border-line p-3">
                    <p className="text-xs font-medium text-ink-2">Proof for this item (optional)</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      Attach proof to be eligible for the Verified badge. Without it, an admin can still
                      approve this item, but it will not be marked Verified.
                    </p>
                    {rowAttachments(row).length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {rowAttachments(row).map((attachment, ai) => (
                          <li
                            key={ai}
                            className="flex items-center justify-between gap-2 rounded-input bg-bg-alt px-3 py-1.5 text-xs text-ink-2"
                          >
                            <span className="truncate">
                              {attachment.type === 'file' ? '📎 ' : '🔗 '}
                              {attachment.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAttachment(i, ai)}
                              className="shrink-0 font-medium text-error"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="rounded-input border border-line-2 px-3 py-1.5 text-xs font-medium text-ink hover:border-ink">
                        {uploadingRow === i ? 'Uploading…' : 'Add file(s)'}
                        <input
                          type="file"
                          multiple
                          accept="image/*,.pdf"
                          disabled={uploadingRow === i}
                          onChange={(e) => {
                            if (e.target.files?.length) handleProofFilesSelected(i, e.target.files);
                            e.target.value = '';
                          }}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        placeholder="…or paste a proof link (https://…)"
                        value={linkDrafts[i] ?? ''}
                        onChange={(e) => setLinkDrafts((prev) => ({ ...prev, [i]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addLinkAttachment(i);
                          }
                        }}
                        className="min-w-0 flex-1 rounded-input border border-line px-3 py-1.5 text-xs outline-none focus:border-ink"
                      />
                      <button
                        type="button"
                        onClick={() => addLinkAttachment(i)}
                        disabled={!(linkDrafts[i] ?? '').trim()}
                        className="rounded-input border border-line-2 px-3 py-1.5 text-xs font-medium text-ink hover:border-ink disabled:opacity-40"
                      >
                        Add link
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!atCap && (
              <button
                type="button"
                onClick={addRow}
                className="rounded-input border border-line-2 px-5 py-2.5 text-sm font-medium text-ink hover:border-ink"
              >
                + Add another
              </button>
            )}
            {atCap && activeSection === 'key_clients' && (
              <p className="text-xs text-ink-3">
                You have reached the maximum of {KEY_CLIENTS_MAX} key clients. Remove one to add another.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {config.fields.map((spec) => (
              <Field
                key={spec.key}
                spec={spec}
                value={(data as Row)[spec.key]}
                onChange={(value) => updateField(null, spec.key, value)}
              />
            ))}
          </div>
        )}

        {needsSharedProof && (
          <div className="rounded-xl border border-line p-4">
            <p className="text-xs font-medium text-ink-2">Proof (optional)</p>
            <p className="mt-0.5 text-xs text-ink-3">
              Proof is needed for the Verified badge. Without it, an admin can still approve the changes
              but they will not be marked Verified.
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setProofMode('file')}
                className={`rounded-full px-3 py-1 text-xs font-medium ${proofMode === 'file' ? 'bg-ink text-bg' : 'bg-bg-alt text-ink-2'}`}
              >
                Upload file
              </button>
              <button
                type="button"
                onClick={() => setProofMode('link')}
                className={`rounded-full px-3 py-1 text-xs font-medium ${proofMode === 'link' ? 'bg-ink text-bg' : 'bg-bg-alt text-ink-2'}`}
              >
                Paste link
              </button>
            </div>
            {proofMode === 'file' ? (
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
                className="mt-3 text-sm"
              />
            ) : (
              <input
                type="text"
                placeholder="https://…"
                value={proofLink}
                onChange={(e) => setProofLink(e.target.value)}
                className="mt-3 w-full rounded-input border border-line px-3 py-2 text-sm outline-none focus:border-ink"
              />
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-input border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Button onClick={handleSubmit} disabled={!canSubmit} fullWidth>
          {submitting ? 'Submitting…' : 'Submit for review'}
        </Button>
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
