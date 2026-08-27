'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { StepActions } from '@/components/apply/StepActions';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ImportedTag } from '@/components/apply/ImportedTag';
import { COUNTRIES, PHONE_CODES, REGIONS, type WizardFormState } from '@/components/apply/types';
import { uploadApplicationFile } from '@/lib/api/applications';
import { ApiError } from '@/lib/api/client';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export function IdentityStep({
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canContinue =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.contactEmail.trim() &&
    form.region &&
    form.country &&
    form.linkedinUrl.trim() &&
    form.bio.trim().length > 0 &&
    form.bio.length <= 500 &&
    !uploading;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after an error
    if (!file) return;

    if (file.size > MAX_PHOTO_BYTES) {
      setUploadError('Photo must be under 5MB.');
      return;
    }

    setUploadError(null);
    setUploading(true);
    try {
      const updated = await uploadApplicationFile('photo', file);
      update({ photoUrl: updated.photoUrl ?? undefined });
    } catch (err) {
      setUploadError(
        err instanceof ApiError ? err.message : 'Failed to upload photo — please try again.'
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h2 className="text-heading text-ink">Your identity.</h2>
      <p className="mt-2 text-lede text-ink-3">
        Personal details, contact info, and your professional presence.
      </p>

      <div className="mt-7 flex flex-col gap-5">
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-full border border-line bg-bg-alt text-ink-3">
            {form.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.photoUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs">No photo</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">Profile photo</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-input border border-line-2 px-4 py-2 text-sm font-medium text-ink hover:border-ink disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : form.photoUrl ? 'Change photo' : 'Upload photo'}
            </button>
            <span className="text-xs text-ink-3">JPEG or PNG, up to 5MB.</span>
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

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            label="First name"
            labelRight={form.importedFields.has('firstName') ? <ImportedTag /> : undefined}
            name="firstName"
            placeholder="Jane"
            value={form.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
            required
          />
          <Input
            label="Last name"
            labelRight={form.importedFields.has('lastName') ? <ImportedTag /> : undefined}
            name="lastName"
            placeholder="Smith"
            value={form.lastName}
            onChange={(e) => update({ lastName: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            label="Contact email"
            name="contactEmail"
            type="email"
            placeholder="you@example.com"
            value={form.contactEmail}
            onChange={(e) => update({ contactEmail: e.target.value })}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-ink-2">
              WhatsApp / Phone <span className="font-normal text-ink-3">(optional)</span>
            </label>
            <div className="flex overflow-hidden rounded-input border border-line">
              <select
                className="border-r border-line bg-bg-alt px-2 text-xs text-ink outline-none"
                value={form.phoneCountryCode}
                onChange={(e) => update({ phoneCountryCode: e.target.value })}
              >
                {PHONE_CODES.map((code) => (
                  <option key={code}>{code}</option>
                ))}
              </select>
              <input
                type="tel"
                placeholder="7700 900 000"
                className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm text-ink outline-none"
                value={form.phone}
                onChange={(e) => update({ phone: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Select
            label="Region"
            value={form.region}
            onChange={(e) => update({ region: e.target.value as WizardFormState['region'] })}
            required
          >
            <option value="">Select region…</option>
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Select
            label="Country"
            value={form.country}
            onChange={(e) => update({ country: e.target.value })}
            required
          >
            <option value="">Select country…</option>
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            label="State / Province"
            labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
            name="state"
            placeholder="e.g. California"
            value={form.state}
            onChange={(e) => update({ state: e.target.value })}
          />
          <Input
            label="City"
            labelRight={
              form.importedFields.has('city') ? (
                <ImportedTag />
              ) : (
                <span className="text-xs font-normal text-ink-3">optional</span>
              )
            }
            name="city"
            placeholder="e.g. London"
            value={form.city}
            onChange={(e) => update({ city: e.target.value })}
          />
        </div>

        <Input
          label="LinkedIn URL"
          name="linkedinUrl"
          type="url"
          placeholder="https://linkedin.com/in/yourprofile"
          value={form.linkedinUrl}
          onChange={(e) => update({ linkedinUrl: e.target.value })}
          required
        />

        <Textarea
          label="Professional bio"
          labelRight={form.importedFields.has('bio') ? <ImportedTag /> : undefined}
          rows={4}
          maxLength={500}
          placeholder="Describe your professional background, expertise, and what makes you uniquely qualified…"
          value={form.bio}
          onChange={(e) => update({ bio: e.target.value })}
          hint={
            <span className={form.bio.length > 500 ? 'text-error' : ''}>
              {form.bio.length} / 500 characters — appears on your public member profile
            </span>
          }
        />
      </div>

      {saveError && (
        <div className="mt-6">
          <ErrorBanner message={saveError} />
        </div>
      )}

      <StepActions
        onBack={onBack}
        onNext={onNext}
        nextLabel={saving ? 'Saving…' : 'Next: Background'}
        nextDisabled={!canContinue || saving}
      />
    </div>
  );
}
