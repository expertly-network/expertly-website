'use client';

import { useState } from 'react';
import { Modal, Input, Textarea, Button } from '@/components/ui';
import {
  EMPTY_ROW,
  SECTION_CONFIG,
  SECTION_TITLES,
  type FieldSpec,
  type SectionConfig,
} from '@/components/members/edit/sectionFieldConfig';
import { createMemberEdit, requestMemberUpload } from '@/lib/api/members';
import { uploadToSignedUrl } from '@/lib/api/upload';
import { ApiError } from '@/lib/api/client';
import type { CreateMemberEditRequest, MemberDto, MemberEditSection } from '@shared/member';

type Row = Record<string, unknown>;

// The native `required` attribute on Input/Textarea never actually blocks
// submission since Submit is a <Button onClick>, not a <form onSubmit> — so
// required-field completeness has to be checked explicitly and folded into
// canSubmit, across every row for list/clients shapes.
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
        contactPhone: member.contactPhone ?? '',
        linkedinUrl: member.linkedinUrl ?? '',
        website: member.website ?? '',
      };
    case 'engagements':
      return member.engagements.length
        ? member.engagements.map(({ id: _id, ...rest }) => rest)
        : [{ ...EMPTY_ROW.engagements }];
    case 'education':
      return member.educations.length
        ? member.educations.map(({ id: _id, ...rest }) => rest)
        : [{ ...EMPTY_ROW.education }];
    case 'work_experiences':
      return member.workExperiences.length
        ? member.workExperiences.map(({ id: _id, ...rest }) => rest)
        : [{ ...EMPTY_ROW.work_experiences }];
    case 'key_clients':
      // logoUrl is carried through unchanged unless a new file is uploaded
      // (see the 'clients'-shape logo input below) — edits replace the
      // section wholesale, so dropping it here would silently wipe an
      // existing client's logo even if the member only meant to add another.
      return member.keyClients.length
        ? member.keyClients.map((c) => ({ name: c.name, logoUrl: c.logoUrl, logoUploadPath: undefined }))
        : [{ ...EMPTY_ROW.key_clients }];
    case 'testimonials':
      return member.testimonials.length
        ? member.testimonials.map(({ id: _id, isVerified: _v, ...rest }) => rest)
        : [{ ...EMPTY_ROW.testimonials }];
    case 'awards':
      return member.awards.length
        ? member.awards.map(({ id: _id, ...rest }) => rest)
        : [{ ...EMPTY_ROW.awards }];
  }
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset local state whenever a new section is opened.
  const [openedSection, setOpenedSection] = useState<MemberEditSection | null>(null);
  if (section && section !== openedSection) {
    setOpenedSection(section);
    setData(initialPayload(member, section));
    setProofMode('link');
    setProofFile(null);
    setProofLink('');
    setError(null);
  }

  if (!section || data === null) return null;

  // Captured as a const so the non-null narrowing survives into the nested
  // closures below (addRow) — a parameter binding loses it there.
  const activeSection = section;

  const config = SECTION_CONFIG[section];
  const needsProof = config.shape === 'list-per-item-proof' || config.shape === 'list-shared-proof';
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

  const proofSatisfied = !needsProof || Boolean(proofFile) || proofLink.trim().length > 0;
  const canSubmit = proofSatisfied && hasRequiredFieldsFilled(config, data) && !submitting;

  // 'clients' shape uploads a logo per-row, immediately on file select (not
  // deferred to submit like proof files) — each row's logoUploadPath is set
  // as soon as its own upload finishes, independent of the other rows.
  async function handleLogoUpload(rowIndex: number, file: File) {
    setError(null);
    try {
      const { uploadUrl, path } = await requestMemberUpload(member.id, {
        fileName: file.name,
        contentType: file.type,
      });
      await uploadToSignedUrl(uploadUrl, file);
      updateField(rowIndex, 'logoUploadPath', path);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Logo upload failed. Please try again.');
    }
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

      const body = {
        section,
        payload: data,
        ...(needsProof
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
                  {config.fields.map((spec) => (
                    <Field
                      key={spec.key}
                      spec={spec}
                      value={row[spec.key]}
                      onChange={(value) => updateField(i, spec.key, value)}
                    />
                  ))}
                </div>
                {config.shape === 'clients' && (
                  <div className="mt-3">
                    {typeof row.logoUrl === 'string' && !row.logoUploadPath && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.logoUrl} alt="" className="mb-2 h-8 object-contain" />
                    )}
                    <label className="text-xs font-medium text-ink-2">Logo</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(i, file);
                      }}
                      className="mt-1 block text-sm"
                    />
                    {row.logoUploadPath ? (
                      <p className="mt-1 text-xs text-ok">New logo uploaded.</p>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
            {rows.length < (config.maxItems ?? Infinity) && (
              <button
                type="button"
                onClick={addRow}
                className="rounded-input border border-line-2 px-5 py-2.5 text-sm font-medium text-ink hover:border-ink"
              >
                + Add another
              </button>
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

        {needsProof && (
          <div className="rounded-xl border border-line p-4">
            <p className="text-xs font-medium text-ink-2">Proof</p>
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
            {!proofSatisfied && (
              <p className="mt-2 text-xs text-error">
                Please attach a file or a link as proof before submitting.
              </p>
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
    </Modal>
  );
}
