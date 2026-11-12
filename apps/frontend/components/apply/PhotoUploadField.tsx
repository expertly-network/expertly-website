'use client';

import { useRef, useState } from 'react';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { apiErrorMessage } from '@/lib/errors/api-error-message';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Round photo preview + upload button. Used by the wizard (the applicant's own photo) and the admin
 * review editor (replacing it). `upload` sends the file and resolves to the new photo URL.
 */
export function PhotoUploadField({
  photoUrl,
  upload,
  onUploaded,
  onUploadingChange,
  error,
  required = false,
  note,
}: {
  photoUrl: string | null;
  upload: (file: File) => Promise<string | null>;
  onUploaded: (photoUrl: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
  error?: string;
  required?: boolean;
  /** Extra line under the button, e.g. a warning about what replacing does. */
  note?: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function setBusy(busy: boolean) {
    setUploading(busy);
    onUploadingChange?.(busy);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after an error
    if (!file) return;

    if (file.size > MAX_PHOTO_BYTES) {
      setUploadError('Photo must be under 5MB.');
      return;
    }

    setUploadError(null);
    setBusy(true);
    try {
      onUploaded(await upload(file));
    } catch (err) {
      setUploadError(apiErrorMessage(err, 'Failed to upload photo — please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div id="photo" tabIndex={-1} className="flex items-center gap-5">
        <div
          className={`flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-full border bg-bg-alt text-ink-3 ${
            error ? 'border-error' : 'border-line'
          }`}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs">No photo</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">
            Profile photo
            {required && (
              <span aria-hidden="true" className="text-error">
                {' '}
                *
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-input border border-line-2 px-4 py-2 text-sm font-medium text-ink hover:border-ink disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : photoUrl ? 'Change photo' : 'Upload photo'}
          </button>
          <span className="text-xs text-ink-3">JPEG or PNG, up to 5MB.</span>
          {note && <span className="text-xs text-ink-3">{note}</span>}
          {error && <span className="text-xs text-error">{error}</span>}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handlePhotoChange}
            className="sr-only"
          />
        </div>
      </div>
      {uploadError && <ErrorBanner message={uploadError} />}
    </>
  );
}
