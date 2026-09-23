'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { StepActions } from '@/components/apply/StepActions';
import { scrollToFirstError } from '@/components/apply/scrollToError';
import { REGIONS, TERMS_VERSION, PRIVACY_VERSION, type WizardFormState } from '@/components/apply/types';
import type { BillingPeriod } from '@shared/membership-application';
import type { CategoryDto } from '@shared/category';

// Static display copy; the authoritative amount always comes from the backend.
const PRICE_LABEL: Record<BillingPeriod, string> = {
  annual: '$499/year',
};

export function ReviewSubmitStep({
  form,
  update,
  categories,
  saving,
  saveError,
  onBack,
  onSubmit,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  categories: CategoryDto[];
  saving?: boolean;
  saveError?: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const services = categories.flatMap((c) => c.services);
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;
  const regionLabel = REGIONS.find((r) => r.value === form.region)?.label ?? form.region;
  const location = [form.city, form.state, form.country].filter(Boolean).join(', ');

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!consentTerms) e.consentTerms = 'You must agree to the Terms of Service to submit.';
    if (!consentPrivacy) e.consentPrivacy = 'You must agree to the Privacy Policy to submit.';
    if (!form.backgroundCheckConsent) {
      e.backgroundCheckConsent = 'You must consent to background verification to submit.';
    }
    return e;
  }

  function handleSubmit() {
    if (saving) return;
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      scrollToFirstError(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit();
  }

  return (
    <div>
      <h2 className="text-heading text-ink">Ready to submit.</h2>
      <p className="mt-2 text-lede text-ink-3">Review your details, then choose your membership plan.</p>

      <div className="mt-7 rounded-2xl border border-line bg-bg-card divide-y divide-line">
        <div className="flex items-center gap-[18px] px-6 py-5">
          <div className="flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-full border-2 border-line-2 bg-bg-alt text-ink-3">
            {form.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.photoUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs">No photo</span>
            )}
          </div>
          <div>
            <div className="text-title text-ink">
              {form.firstName} {form.lastName}
            </div>
            <div className="mt-1 text-xs text-ink-3">{form.contactEmail}</div>
          </div>
        </div>
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
            .map((p) => (p.customLabel ? `${serviceName(p.serviceId)} (${p.customLabel})` : serviceName(p.serviceId)))
            .join(' · ')}
        />
        <ReviewRow
          label="Rate"
          value={`$${form.rateMinDollars} – $${form.rateMaxDollars} / hour`}
        />
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <span className="text-mono-label text-ink-3">MEMBERSHIP PLAN</span>
        <p className="mt-1.5 text-sm text-ink-3">Billed annually — one plan, no tiers.</p>

        <div className="mt-4 rounded-2xl border border-ink bg-bg-alt p-5">
          <div className="text-mono-label text-ink-3">Annual</div>
          <div className="mt-1.5 text-title text-ink">{PRICE_LABEL.annual}</div>
        </div>

        <div className="mt-5">
          <Input
            label="Coupon code"
            labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
            placeholder="Enter a code"
            value={form.couponCode}
            onChange={(e) => update({ couponCode: e.target.value })}
          />
          <p className="mt-1.5 text-xs text-ink-3">Apply a coupon code to your order.</p>
        </div>
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <span className="text-mono-label text-ink-3">DECLARATION &amp; CONSENT</span>

        <div className="mt-4 flex flex-col gap-3">
          <div>
            <label
              className={`flex items-start gap-3 rounded-input border bg-bg-alt px-3.5 py-3 text-sm ${
                errors.consentTerms ? 'border-error' : 'border-line-2'
              }`}
            >
              <input
                id="consentTerms"
                type="checkbox"
                className="mt-0.5"
                checked={consentTerms}
                onChange={(e) => setConsentTerms(e.target.checked)}
              />
              <span className="text-ink-2">
                I agree to the <span className="font-medium text-accent">Terms of Service</span> (v{TERMS_VERSION}).
              </span>
            </label>
            {errors.consentTerms && <p className="mt-1 text-xs text-error">{errors.consentTerms}</p>}
          </div>
          <div>
            <label
              className={`flex items-start gap-3 rounded-input border bg-bg-alt px-3.5 py-3 text-sm ${
                errors.consentPrivacy ? 'border-error' : 'border-line-2'
              }`}
            >
              <input
                id="consentPrivacy"
                type="checkbox"
                className="mt-0.5"
                checked={consentPrivacy}
                onChange={(e) => setConsentPrivacy(e.target.checked)}
              />
              <span className="text-ink-2">
                I agree to the <span className="font-medium text-accent">Privacy Policy</span> (v{PRIVACY_VERSION}).
              </span>
            </label>
            {errors.consentPrivacy && <p className="mt-1 text-xs text-error">{errors.consentPrivacy}</p>}
          </div>
          <div>
            <label
              className={`flex items-start gap-3 rounded-input border bg-bg-alt px-3.5 py-3 text-sm ${
                errors.backgroundCheckConsent ? 'border-error' : 'border-line-2'
              }`}
            >
              <input
                id="backgroundCheckConsent"
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
            {errors.backgroundCheckConsent && (
              <p className="mt-1 text-xs text-error">{errors.backgroundCheckConsent}</p>
            )}
          </div>
        </div>
      </div>

      {saveError && (
        <div className="mt-6">
          <ErrorBanner message={saveError} />
        </div>
      )}

      <StepActions
        onBack={onBack}
        onNext={handleSubmit}
        nextLabel={saving ? 'Submitting…' : 'Submit application'}
        nextDisabled={saving}
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
