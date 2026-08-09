'use client';

import { FormField } from '@/components/auth/FormField';
import { SelectField } from '@/components/apply/SelectField';
import { TextareaField } from '@/components/apply/TextareaField';
import { StepActions } from '@/components/apply/StepActions';
import { COUNTRIES, PHONE_CODES, REGIONS, type WizardFormState } from '@/components/apply/types';

export function IdentityStep({
  form,
  update,
  onBack,
  onNext,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const canContinue =
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.contactEmail.trim() &&
    form.region &&
    form.country &&
    form.linkedinUrl.trim() &&
    form.bio.trim().length > 0 &&
    form.bio.length <= 500;

  return (
    <div>
      <h2 className="text-heading text-ink">Your identity.</h2>
      <p className="mt-2 text-sm text-ink-3">
        Personal details, contact info, and your professional presence.
      </p>

      <div className="mt-7 flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <FormField
            label="First name"
            name="firstName"
            placeholder="Jane"
            value={form.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
            required
          />
          <FormField
            label="Last name"
            name="lastName"
            placeholder="Smith"
            value={form.lastName}
            onChange={(e) => update({ lastName: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <FormField
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
          <SelectField
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
          </SelectField>
          <SelectField
            label="Country"
            value={form.country}
            onChange={(e) => update({ country: e.target.value })}
            required
          >
            <option value="">Select country…</option>
            {COUNTRIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </SelectField>
        </div>

        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <FormField
            label="State / Province"
            labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
            name="state"
            placeholder="e.g. California"
            value={form.state}
            onChange={(e) => update({ state: e.target.value })}
          />
          <FormField
            label="City"
            labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
            name="city"
            placeholder="e.g. London"
            value={form.city}
            onChange={(e) => update({ city: e.target.value })}
          />
        </div>

        <FormField
          label="LinkedIn URL"
          name="linkedinUrl"
          type="url"
          placeholder="https://linkedin.com/in/yourprofile"
          value={form.linkedinUrl}
          onChange={(e) => update({ linkedinUrl: e.target.value })}
          required
        />

        <TextareaField
          label="Professional bio"
          rows={4}
          maxLength={500}
          placeholder="Describe your professional background, expertise, and what makes you uniquely qualified…"
          value={form.bio}
          onChange={(e) => update({ bio: e.target.value })}
          hint={
            <span className={form.bio.length > 500 ? 'text-red-600' : ''}>
              {form.bio.length} / 500 characters — appears on your public member profile
            </span>
          }
        />
      </div>

      <StepActions onBack={onBack} onNext={onNext} nextLabel="Next: Background" nextDisabled={!canContinue} />
    </div>
  );
}
