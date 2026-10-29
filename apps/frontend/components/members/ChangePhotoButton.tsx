'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ImageCropper } from '@/components/ui/ImageCropper';
import { ApiError } from '@/lib/api/client';
import { requestMemberUpload, updateMember } from '@/lib/api/members';
import { uploadToSignedUrl } from '@/lib/api/upload';

const ACCEPT = 'image/jpeg,image/png,image/webp';
const MAX_SOURCE_BYTES = 10 * 1024 * 1024; // the cropped 512px export is far smaller than this

// Owner-only overlay on the profile avatar: pick → crop (square) → upload → live immediately.
// Rendered inside the avatar's `relative` wrapper by ProfileHeader.
export function ChangePhotoButton({ memberId }: { memberId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onPick(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      setError('That image is over 10MB — choose a smaller one.');
      return;
    }
    setError(null);
    setPending(file);
  }

  async function save(cropped: File) {
    setPending(null);
    setSaving(true);
    setError(null);
    try {
      const { uploadUrl, path } = await requestMemberUpload(memberId, cropped);
      await uploadToSignedUrl(uploadUrl, cropped);
      await updateMember(memberId, { photoUploadPath: path });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update your photo — please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={saving}
        aria-label="Change profile photo"
        className="absolute inset-x-1 bottom-1 z-[2] flex items-center justify-center gap-1.5 rounded-b-xl bg-black/55 py-1.5 text-[11.5px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-black/70 disabled:cursor-wait"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        {saving ? 'Saving…' : 'Change photo'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      {error && (
        <p
          role="alert"
          className="absolute left-0 top-full z-[3] mt-2 w-[220px] rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700"
        >
          {error}
        </p>
      )}
      {pending && <ImageCropper file={pending} subject="photo" onCancel={() => setPending(null)} onConfirm={save} />}
    </>
  );
}
