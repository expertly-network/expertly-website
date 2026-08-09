'use client';

import { FormField } from '@/components/auth/FormField';
import { StepActions } from '@/components/apply/StepActions';
import type { WizardFormState } from '@/components/apply/types';

// Unlike the design's prototype, this doesn't simulate an auto-import —
// there's no real LinkedIn profile-scraping backend behind it (LinkedIn
// OAuth via Supabase only authenticates login, it doesn't fetch profile
// data). The URL is still captured for real (carried into Step 2, and
// submitted as linkedinUrl), just without pretending to fetch anything else.
export function LinkedInImportStep({
  form,
  update,
  onNext,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  onNext: () => void;
}) {
  const canContinue = form.linkedinUrl.trim().length > 0 && form.linkedinImportConsent;

  return (
    <div>
      <h2 className="text-heading text-ink">Connect your LinkedIn.</h2>
      <p className="mt-2 text-sm text-ink-3">
        Your LinkedIn URL will be carried through the application and shown on your public profile
        once approved. Skip this if you&apos;d rather add it manually in the next step.
      </p>

      <div className="mt-7 flex flex-col gap-5 rounded-2xl border border-line bg-bg-alt p-6">
        <FormField
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
            I confirm this is my professional LinkedIn profile and consent to it being displayed
            on my member listing.
          </span>
        </label>
      </div>

      <StepActions backHidden onNext={onNext} nextLabel="Continue" nextDisabled={!canContinue} />
    </div>
  );
}
