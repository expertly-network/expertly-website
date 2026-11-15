'use client';

import { useState } from 'react';
import { requestMemberUpload } from '@/lib/api/members';
import { uploadToSignedUrl } from '@/lib/api/upload';
import { apiErrorMessage } from '@/lib/errors/api-error-message';
import type { ProofAttachment } from '@shared/member';

const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/gif';

// Optional proof for one entry: any mix of files (uploaded straight to private storage) and links.
// Each upload appends, never replaces. Proof is the member's choice — it speeds up verification
// but is never required. Files can be picked or dropped onto the zone.
export function ProofAttachments({
  memberId,
  attachments,
  onChange,
  onError,
  examples,
}: {
  memberId: string;
  attachments: ProofAttachment[];
  /** What counts as proof for this kind of entry ("an engagement letter, …"). */
  examples?: string;
  onChange: (next: ProofAttachment[]) => void;
  onError: (message: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [linkDraft, setLinkDraft] = useState('');

  async function handleFiles(files: FileList | File[]) {
    onError(null);
    setUploading(true);
    try {
      const uploaded: ProofAttachment[] = [];
      for (const file of Array.from(files)) {
        const { uploadUrl, path } = await requestMemberUpload(memberId, file);
        await uploadToSignedUrl(uploadUrl, file);
        uploaded.push({ type: 'file', url: path, label: file.name });
      }
      onChange([...attachments, ...uploaded]);
    } catch (err) {
      onError(apiErrorMessage(err, 'File upload failed. Please try again.'));
    } finally {
      setUploading(false);
    }
  }

  function addLink() {
    const url = linkDraft.trim();
    if (!url) return;
    onChange([...attachments, { type: 'link', url, label: url }]);
    setLinkDraft('');
  }

  return (
    <div className="rounded-2xl border border-[color-mix(in_oklab,var(--accent)_28%,var(--line))] bg-[color-mix(in_oklab,var(--accent)_4%,transparent)] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-bg-card text-accent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">
            Get verified faster <span className="font-normal text-ink-3">· optional</span>
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
            Entries with proof can be verified without any back-and-forth
            {examples ? <> — try {examples}</> : null}. No proof to hand? Save without it; we may ask for it later.
          </p>
        </div>
      </div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
        }}
        className={`mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-xl border-[1.5px] border-dashed px-4 py-4 text-center transition-colors focus-within:ring-[3px] focus-within:ring-ink/[0.08] ${
          dragging
            ? 'border-accent bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]'
            : 'border-line-2 bg-bg-card hover:border-ink-3'
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-accent">
          <path
            d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-sm font-medium text-ink">
          {uploading ? 'Uploading…' : 'Drop a file here, or click to choose'}
        </span>
        <span className="text-xs text-ink-3">PDF or image</span>
        <input
          type="file"
          multiple
          accept={ACCEPT}
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = '';
          }}
          className="sr-only"
        />
      </label>

      {attachments.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {attachments.map((attachment, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 rounded-input bg-bg-alt px-3 py-2 text-xs text-ink-2"
            >
              <span className="truncate">
                {attachment.type === 'file' ? '📎 ' : '🔗 '}
                {attachment.label}
              </span>
              <button
                type="button"
                onClick={() => onChange(attachments.filter((_, j) => j !== i))}
                className="shrink-0 font-medium text-error"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex gap-2">
        <input
          type="text"
          placeholder="…or paste a link to proof (https://…)"
          value={linkDraft}
          onChange={(e) => setLinkDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addLink();
            }
          }}
          className="min-w-0 flex-1 rounded-input border border-line px-3 py-2.5 text-base outline-none focus:border-ink sm:text-sm"
        />
        <button
          type="button"
          onClick={addLink}
          disabled={!linkDraft.trim()}
          className="rounded-input border border-line-2 px-4 py-2.5 text-sm font-medium text-ink hover:border-ink disabled:opacity-40"
        >
          Add link
        </button>
      </div>
    </div>
  );
}
