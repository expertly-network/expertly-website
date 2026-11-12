'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { StepActions } from '@/components/apply/StepActions';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ImportedTag } from '@/components/apply/ImportedTag';
import { LocationFields } from '@/components/apply/LocationFields';
import { PhoneField } from '@/components/apply/PhoneField';
import { PhotoUploadField } from '@/components/apply/PhotoUploadField';
import type { WizardFormState } from '@/components/apply/types';
import { scrollToFirstError } from '@/components/apply/scrollToError';
import { uploadApplicationFile } from '@/lib/api/applications';
import { EMAIL_PATTERN, LINKEDIN_PROFILE_URL_PATTERN } from '@/lib/apply/save-errors';

const BIO_MAX_CHARS = 2000;

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
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!form.photoUrl) e.photo = 'Profile photo is required.';
    if (!form.firstName.trim()) e.firstName = 'First name is required.';
    if (!form.lastName.trim()) e.lastName = 'Last name is required.';
    if (!form.workEmail.trim()) e.workEmail = 'Work email is required.';
    else if (!EMAIL_PATTERN.test(form.workEmail.trim())) e.workEmail = 'Enter a valid email address.';
    if (!form.contactEmail.trim()) e.contactEmail = 'Contact email is required.';
    else if (!EMAIL_PATTERN.test(form.contactEmail.trim())) e.contactEmail = 'Enter a valid email address.';
    // Same rule the backend applies at submit: 6-15 digits, whatever the spacing/punctuation.
    const phoneDigits = form.phone.replace(/\D/g, '').length;
    if (phoneDigits === 0) e.phone = 'Phone number is required.';
    else if (phoneDigits < 6 || phoneDigits > 15) e.phone = 'Enter a valid phone number.';
    if (!form.country) e.country = 'Country is required.';
    if (!form.linkedinUrl.trim()) e.linkedinUrl = 'LinkedIn URL is required.';
    else if (!LINKEDIN_PROFILE_URL_PATTERN.test(form.linkedinUrl.trim())) {
      e.linkedinUrl = 'Enter your LinkedIn profile URL (linkedin.com/in/…).';
    }
    if (!form.bio.trim()) e.bio = 'Professional bio is required.';
    else if (form.bio.length > BIO_MAX_CHARS) e.bio = `Bio must be ${BIO_MAX_CHARS} characters or fewer.`;
    return e;
  }

  // Clears a field's error as soon as its value changes, instead of leaving a stale red
  // border/message on screen until the next full-form validation pass.
  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleNext() {
    if (uploading) return;
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      scrollToFirstError(fieldErrors);
      return;
    }
    setErrors({});
    onNext();
  }

  return (
    <div>
      <h2 className="text-heading text-ink">Your identity.</h2>
      <p className="mt-2 text-lede text-ink-3">Personal details, contact info, and your professional presence.</p>

      <div className="mt-7 flex flex-col gap-5">
        <PhotoUploadField
          photoUrl={form.photoUrl ?? null}
          required
          error={errors.photo}
          upload={async (file) => (await uploadApplicationFile('photo', file)).photoUrl}
          onUploaded={(photoUrl) => {
            update({ photoUrl: photoUrl ?? undefined });
            clearError('photo');
          }}
          onUploadingChange={setUploading}
        />

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            label="First name"
            markRequired
            labelRight={form.importedFields.has('firstName') ? <ImportedTag /> : undefined}
            name="firstName"
            placeholder="Jane"
            value={form.firstName}
            onChange={(e) => {
              update({ firstName: e.target.value });
              clearError('firstName');
            }}
            error={errors.firstName}
            required
          />
          <Input
            label="Last name"
            markRequired
            labelRight={form.importedFields.has('lastName') ? <ImportedTag /> : undefined}
            name="lastName"
            placeholder="Smith"
            value={form.lastName}
            onChange={(e) => {
              update({ lastName: e.target.value });
              clearError('lastName');
            }}
            error={errors.lastName}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            label="Work email"
            markRequired
            name="workEmail"
            type="email"
            autoComplete="work email"
            placeholder="you@company.com"
            hint="All GrowXQ emails go here."
            value={form.workEmail}
            onChange={(e) => {
              update({ workEmail: e.target.value });
              clearError('workEmail');
            }}
            error={errors.workEmail}
            required
          />
          <Input
            label="Contact email"
            markRequired
            name="contactEmail"
            type="email"
            placeholder="you@example.com"
            hint="Kept on file only — we don't send email here."
            value={form.contactEmail}
            onChange={(e) => {
              update({ contactEmail: e.target.value });
              clearError('contactEmail');
            }}
            error={errors.contactEmail}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <PhoneField
            countryCode={form.phoneCountryCode}
            phone={form.phone}
            onCountryCodeChange={(phoneCountryCode) => update({ phoneCountryCode })}
            onPhoneChange={(phone) => {
              update({ phone });
              clearError('phone');
            }}
            error={errors.phone}
          />
        </div>

        {/* Region is no longer picked here — the backend derives it server-side from country. */}
        <LocationFields
          form={form}
          update={update}
          countryError={errors.country}
          onCountryChange={() => clearError('country')}
        />

        <Input
          label="LinkedIn URL"
          markRequired
          name="linkedinUrl"
          type="url"
          placeholder="https://linkedin.com/in/yourprofile"
          value={form.linkedinUrl}
          onChange={(e) => {
            update({ linkedinUrl: e.target.value });
            clearError('linkedinUrl');
          }}
          error={errors.linkedinUrl}
          required
        />

        <Textarea
          id="bio"
          label="Professional bio"
          markRequired
          labelRight={form.importedFields.has('bio') ? <ImportedTag /> : undefined}
          rows={4}
          autoGrow
          maxLength={BIO_MAX_CHARS}
          placeholder="Describe your professional background, expertise, and what makes you uniquely qualified…"
          value={form.bio}
          onChange={(e) => {
            update({ bio: e.target.value });
            clearError('bio');
          }}
          error={errors.bio}
          hint={`${form.bio.length} / ${BIO_MAX_CHARS} characters — appears on your public member profile`}
        />
      </div>

      {saveError && (
        <div className="mt-6">
          <ErrorBanner message={saveError} />
        </div>
      )}

      <StepActions
        onBack={onBack}
        onNext={handleNext}
        nextLabel={saving ? 'Saving…' : uploading ? 'Uploading photo…' : 'Next: Background'}
        nextDisabled={saving || uploading}
      />
    </div>
  );
}
