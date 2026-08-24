'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { StepActions } from '@/components/apply/StepActions';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ImportingLoader } from '@/components/apply/ImportingLoader';
import type { WizardFormState } from '@/components/apply/types';
import { importLinkedIn } from '@/lib/api/applications';
import { ApiError } from '@/lib/api/client';

// Real import: fetches normalized profile data from the backend's
// LinkedInImportProvider (a deterministic mock today — see
// docs/superpowers/specs/2026-08-23-member-application-form-design.md §5;
// the real n8n-backed provider is a future swap with no UI change needed).
// Fields the provider couldn't produce are left empty for the applicant to
// fill in later steps, same as the manual-entry path.
export function LinkedInImportStep({
  form,
  update,
  saving,
  saveError,
  onNext,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  saving?: boolean;
  saveError?: string | null;
  // Accepts the just-imported patch so the parent's save can use it directly instead of reading
  // `form` — calling update() and then onNext() synchronously in the same handler races React's
  // batched setState, so `form` here would still be pre-import at the time onNext runs otherwise.
  onNext: (overrides?: Partial<WizardFormState>) => void;
}) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const canImport = form.linkedinUrl.trim().length > 0 && form.linkedinImportConsent && !importing;
  // Stays "busy" across both the LinkedIn fetch (`importing`) and the subsequent save-and-advance
  // call the parent makes right after (`saving`) — onNext() below kicks that save off but doesn't
  // await it, so without this the loader would flicker off between the two phases even though
  // nothing has actually finished from the applicant's point of view yet.
  const busy = importing || Boolean(saving);

  async function handleContinue() {
    setImportError(null);
    setImporting(true);
    try {
      const result = await importLinkedIn({ linkedinUrl: form.linkedinUrl });
      const importedFields = new Set(form.importedFields);
      const patch: Partial<WizardFormState> = {};
      if (result.firstName) {
        patch.firstName = result.firstName;
        importedFields.add('firstName');
      }
      if (result.lastName) {
        patch.lastName = result.lastName;
        importedFields.add('lastName');
      }
      if (result.bio) {
        patch.bio = result.bio;
        importedFields.add('bio');
      }
      if (result.yearsOfExperience != null) {
        patch.yearsOfExperience = String(result.yearsOfExperience);
        importedFields.add('yearsOfExperience');
      }
      if (result.workExperiences?.length) {
        patch.workExperiences = result.workExperiences;
        importedFields.add('workExperiences');
      }
      if (result.educations?.length) {
        patch.educations = result.educations;
        importedFields.add('educations');
      }
      if (result.country) {
        patch.country = result.country;
        importedFields.add('country');
      }
      if (result.city) {
        patch.city = result.city;
        importedFields.add('city');
      }
      // update() would clear these same keys from importedFields (it treats every patched key as
      // "just edited by the user") — set the tracked set directly, after update(), instead.
      update(patch);
      update({ importedFields });
      // Pass the patch straight through — see onNext's doc comment above for why `form` alone
      // isn't safe to rely on here.
      onNext({ ...patch, importedFields });
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'Failed to import from LinkedIn — please try again.');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <h2 className="text-heading text-ink">Connect your LinkedIn.</h2>
      <p className="mt-2 text-sm text-ink-3">
        We&apos;ll pre-fill what we can from your LinkedIn profile — you&apos;ll review and can
        edit everything before submitting. Skip this if you&apos;d rather add it manually in the
        next step.
      </p>

      {busy ? (
        <div className="mt-7 rounded-2xl border border-line bg-bg-alt">
          <ImportingLoader />
        </div>
      ) : (
        <>
          <div className="mt-7 flex flex-col gap-5 rounded-2xl border border-line bg-bg-alt p-6">
            <Input
              label="LinkedIn profile URL"
              name="linkedinUrl"
              type="url"
              placeholder="https://linkedin.com/in/your-name"
              value={form.linkedinUrl}
              onChange={(e) => update({ linkedinUrl: e.target.value })}
            />

            <label className="flex cursor-pointer items-start gap-3 rounded-input border border-line bg-bg-card px-3.5 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={form.linkedinImportConsent}
                onChange={(e) => update({ linkedinImportConsent: e.target.checked })}
              />
              <span className="text-ink-2">
                I confirm this is my professional LinkedIn profile and consent to it being
                displayed on my member listing.
              </span>
            </label>
          </div>

          {(importError || saveError) && (
            <div className="mt-6">
              <ErrorBanner message={importError ?? saveError ?? null} />
            </div>
          )}

          <StepActions
            backHidden
            onNext={handleContinue}
            nextLabel="Continue"
            nextDisabled={!canImport}
          />

          <button
            type="button"
            onClick={() => onNext()}
            className="mt-4 block text-sm font-medium text-ink-3 hover:text-ink"
          >
            Skip — I&apos;ll fill this in manually →
          </button>
        </>
      )}
    </div>
  );
}
