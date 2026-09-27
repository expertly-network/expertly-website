'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { StepActions } from '@/components/apply/StepActions';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { ImportingLoader } from '@/components/apply/ImportingLoader';
import { PHONE_COUNTRY_CODES, type WizardFormState } from '@/components/apply/types';
import { importLinkedIn } from '@/lib/api/applications';
import { ApiError } from '@/lib/api/client';
import { hasLinkedInIdentity, linkLinkedInIdentity } from '@/lib/auth/linkedin';
import { LINKEDIN_DATA_USE_URL } from '@/lib/legal';

// Imports normalized profile data; fields it couldn't produce are left for manual entry.
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
  // Accepts the just-imported patch since `form` may not be updated yet when this runs.
  onNext: (overrides?: Partial<WizardFormState>) => void;
}) {
  const [importing, setImporting] = useState(false);
  // Set once the real import response is in, so ImportingLoader knows to catch up to its last
  // stage instead of holding at normal pace — see handleLoaderReachedEnd for why navigation
  // itself waits on that, not on the fetch alone.
  const [importDone, setImportDone] = useState(false);
  const pendingAdvanceRef = useRef<Partial<WizardFormState> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  // null = still checking; applicants must connect a real LinkedIn account before they can
  // continue — this is what lets us trust the profile being imported/displayed is genuinely
  // theirs, and replaces the old "just paste any URL" flow.
  const [linkedinLinked, setLinkedinLinked] = useState<boolean | null>(null);
  const [linkPending, setLinkPending] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  // Two separate consents: connecting LinkedIn (linkedinLinked, above) verifies identity; this
  // checkbox is the applicant's consent to Expertly actually extracting bio/work-history/
  // education text from their public profile and displaying it on their member listing. Being
  // connected doesn't imply the second — an applicant can connect to satisfy the identity check
  // and still choose "Skip" to enter everything manually instead.
  const canImport = form.linkedinUrl.trim().length > 0 && form.linkedinImportConsent && !importing;
  // Stays busy through both the import and the parent's save-and-advance call.
  const busy = importing || Boolean(saving);

  // Just UI-gating here — actually reconciling linkedinImportConsent/photoUrl once a LinkedIn
  // identity is confirmed happens centrally in ApplicationWizard (see its comment), since
  // connecting LinkedIn's full-page redirect can land back on any step, not necessarily this one.
  useEffect(() => {
    let cancelled = false;
    hasLinkedInIdentity().then((linked) => {
      if (!cancelled) setLinkedinLinked(linked);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleConnect() {
    setLinkPending(true);
    setLinkError(null);
    const { error } = await linkLinkedInIdentity('/apply');
    if (error) {
      setLinkError(error);
      setLinkPending(false);
    }
    // On success, Supabase redirects the browser away — no further state to set.
  }

  // The loader calls this once it's visually caught up to its last stage — not the same moment
  // as the fetch resolving. A fast response would otherwise yank the loader away mid-sentence
  // (e.g. still on "Reading your education history…"); this way it always reads as finishing
  // its thought first, without holding up a genuinely slow response any further than it already
  // takes.
  function handleLoaderReachedEnd() {
    const pending = pendingAdvanceRef.current;
    if (!pending) return;
    onNext(pending);
    // From here, `busy` is carried by the parent's `saving` prop instead — resetting `importing`
    // now (rather than leaving it stuck true) means that if the parent's save fails, `busy` can
    // still drop back to false and this step shows the recoverable error state instead of holding
    // the loader up forever.
    setImporting(false);
  }

  async function handleContinue() {
    setImportError(null);
    setImporting(true);
    setImportDone(false);
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
        // The scrape has no phone number to give us, but the country it does give us is enough
        // to default the WhatsApp/phone country code instead of leaving it on INITIAL_WIZARD_STATE's
        // '+1' regardless of where the applicant actually is.
        const dialCode = PHONE_COUNTRY_CODES.find((p) => p.country === result.country)?.code;
        if (dialCode) {
          patch.phoneCountryCode = dialCode;
          importedFields.add('phoneCountryCode');
        }
      }
      if (result.state) {
        patch.state = result.state;
        importedFields.add('state');
      }
      if (result.city) {
        patch.city = result.city;
        importedFields.add('city');
      }
      // Set after update(), which would otherwise clear these same keys.
      update(patch);
      update({ importedFields });
      // Don't navigate yet — hand off to the loader and let handleLoaderReachedEnd do it once
      // the catch-up animation finishes. importing/busy stays true until then (or until this step
      // unmounts on advance), so the loader keeps rendering throughout.
      pendingAdvanceRef.current = { ...patch, importedFields };
      setImportDone(true);
    } catch (err) {
      setImportError(err instanceof ApiError ? err.message : 'Failed to import from LinkedIn — please try again.');
      setImporting(false);
    }
  }

  if (linkedinLinked === null) {
    return (
      <div>
        <h2 className="text-heading text-ink">Connect your LinkedIn.</h2>
        <div className="mt-7 rounded-2xl border border-line bg-bg-alt">
          <ImportingLoader />
        </div>
      </div>
    );
  }

  if (!linkedinLinked) {
    return (
      <div>
        <h2 className="text-heading text-ink">Connect your LinkedIn.</h2>
        <p className="mt-2 text-lede text-ink-3">
          Membership applicants must connect a real LinkedIn account — this confirms the profile
          you&apos;re applying with is genuinely yours and lets us pull your photo automatically.
        </p>

        <div className="mt-7 flex flex-col gap-4 rounded-2xl border border-line bg-bg-alt p-6">
          <ErrorBanner message={linkError} />
          <Button type="button" onClick={handleConnect} disabled={linkPending} fullWidth>
            {linkPending ? 'Redirecting to LinkedIn…' : 'Connect your LinkedIn'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-heading text-ink">Connect your LinkedIn.</h2>
      <p className="mt-2 text-lede text-ink-3">
        Your LinkedIn account is connected. We&apos;ll pre-fill what we can from your public
        profile — you&apos;ll review and can edit everything before submitting. Skip this if
        you&apos;d rather add it manually in the next step.
      </p>

      {busy ? (
        <div className="mt-7 rounded-2xl border border-line bg-bg-alt">
          <ImportingLoader done={importDone} onReachedEnd={handleLoaderReachedEnd} />
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
                I consent to Expertly extracting my bio, work history, and education from this
                LinkedIn profile and displaying it on my member listing.{' '}
                <a
                  href={LINKEDIN_DATA_USE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline hover:text-ink"
                  onClick={(e) => e.stopPropagation()}
                >
                  Learn more
                </a>
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
            leftSlot={
              <button
                type="button"
                onClick={() => onNext()}
                className="text-sm font-medium text-ink-3 hover:text-ink"
              >
                Skip — I&apos;ll fill this in manually →
              </button>
            }
            onNext={handleContinue}
            nextLabel="Continue"
            nextDisabled={!canImport}
          />
        </>
      )}
    </div>
  );
}
