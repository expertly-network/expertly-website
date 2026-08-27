'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { StepActions } from '@/components/apply/StepActions';
import { REGIONS, TERMS_VERSION, PRIVACY_VERSION, type WizardFormState } from '@/components/apply/types';
import type { BillingPeriod } from '@shared/membership-application';
import type { PracticeAreaDto } from '@shared/practice-area';

// Static display copy, matching design/static_html/membership.html exactly
// ("$499/year or $49/month, all professionals, no tier-based pricing").
// The authoritative amount is always whatever POST /v1/applications returns
// — this is just UI copy, not something computed/trusted client-side.
const PRICE_LABEL: Record<BillingPeriod, string> = {
  monthly: '$49/month',
  annual: '$499/year',
};

export function ReviewSubmitStep({
  form,
  update,
  practiceAreas,
  saving,
  saveError,
  onBack,
  onSubmit,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  practiceAreas: PracticeAreaDto[];
  saving?: boolean;
  saveError?: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);

  const practiceAreaName = (id: string) => practiceAreas.find((a) => a.id === id)?.name ?? id;
  const regionLabel = REGIONS.find((r) => r.value === form.region)?.label ?? form.region;
  const location = [form.city, form.state, form.country].filter(Boolean).join(', ');

  const canSubmit = consentTerms && consentPrivacy && form.backgroundCheckConsent && !saving;

  return (
    <div>
      <h2 className="text-heading text-ink">Ready to submit.</h2>
      <p className="mt-2 text-lede text-ink-3">Review your details, then choose your membership plan.</p>

      <div className="mt-7 rounded-2xl border border-line bg-bg-card divide-y divide-line">
        <ReviewRow label="Name" value={`${form.firstName} ${form.lastName}`} />
        <ReviewRow label="Email" value={form.contactEmail} />
        <ReviewRow label="Phone" value={form.phone ? `${form.phoneCountryCode} ${form.phone}` : '—'} />
        <ReviewRow label="Location" value={[location, regionLabel].filter(Boolean).join(' · ') || '—'} />
        <ReviewRow label="LinkedIn" value={form.linkedinUrl} />
        <ReviewRow label="Bio" value={form.bio} multiline />
        <ReviewRow label="Experience" value={`${form.yearsOfExperience} years`} />
        <ReviewRow
          label="Work history"
          value={form.workExperiences.map((w) => `${w.title} at ${w.company}`).join(' · ')}
        />
        <ReviewRow
          label="Education"
          value={form.educations.map((e) => `${e.degree}, ${e.institution}`).join(' · ')}
        />
        <ReviewRow
          label="Services"
          value={form.servicePreferences
            .map((p) => practiceAreaName(p.practiceAreaId))
            .join(' · ')}
        />
        <ReviewRow
          label="Rate"
          value={`$${form.rateMinDollars} – $${form.rateMaxDollars} / hour`}
        />
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <span className="text-mono-label text-ink-3">MEMBERSHIP PLAN</span>
        <p className="mt-1.5 text-sm text-ink-3">
          Same plan either way — pick how you&apos;d like to be billed.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
          {(['monthly', 'annual'] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => update({ billingPeriod: period })}
              className={`rounded-2xl border p-5 text-left transition-colors ${
                form.billingPeriod === period ? 'border-ink bg-bg-alt' : 'border-line hover:border-ink-3'
              }`}
            >
              <div className="text-mono-label text-ink-3">
                {period === 'monthly' ? 'Monthly' : 'Annual · best value'}
              </div>
              <div className="mt-1.5 text-title text-ink">{PRICE_LABEL[period]}</div>
            </button>
          ))}
        </div>

        <div className="mt-5">
          <Input
            label="Coupon code"
            labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
            placeholder="Enter a code"
            value={form.couponCode}
            onChange={(e) => update({ couponCode: e.target.value })}
          />
          <p className="mt-1.5 text-xs text-ink-3">
            Applied when you submit — if it&apos;s valid, your amount due becomes $0.
          </p>
        </div>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <span className="text-mono-label text-ink-3">DECLARATION &amp; CONSENT</span>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex items-start gap-3 rounded-input border border-line-2 bg-bg-alt px-3.5 py-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={consentTerms} onChange={(e) => setConsentTerms(e.target.checked)} />
            <span className="text-ink-2">
              I agree to the <span className="font-medium text-accent">Terms of Service</span> (v{TERMS_VERSION}).
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-input border border-line-2 bg-bg-alt px-3.5 py-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={consentPrivacy} onChange={(e) => setConsentPrivacy(e.target.checked)} />
            <span className="text-ink-2">
              I agree to the <span className="font-medium text-accent">Privacy Policy</span> (v{PRIVACY_VERSION}).
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-input border border-line-2 bg-bg-alt px-3.5 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.backgroundCheckConsent}
              onChange={(e) => update({ backgroundCheckConsent: e.target.checked })}
            />
            <span className="text-ink-2">
              I consent to Expertly verifying my professional credentials and background as part of
              the membership review process.
            </span>
          </label>
        </div>
      </div>

      {saveError && (
        <div className="mt-6">
          <ErrorBanner message={saveError} />
        </div>
      )}

      <StepActions
        onBack={onBack}
        onNext={onSubmit}
        nextLabel={saving ? 'Submitting…' : 'Submit application'}
        nextDisabled={!canSubmit}
      />
    </div>
  );
}

function ReviewRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={`grid grid-cols-[140px_1fr] gap-4 px-6 py-3.5 text-sm ${multiline ? 'items-start' : 'items-center'}`}>
      <span className="text-mono-label text-ink-3">{label}</span>
      <span className={`text-ink ${multiline ? 'whitespace-pre-wrap' : ''}`}>{value || '—'}</span>
    </div>
  );
}
