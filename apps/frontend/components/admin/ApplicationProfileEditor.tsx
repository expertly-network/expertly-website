'use client';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { Input, Textarea } from '@/components/ui';
import { LocationFields } from '@/components/apply/LocationFields';
import { PhoneField } from '@/components/apply/PhoneField';
import { WorkHistoryFields } from '@/components/apply/WorkHistoryFields';
import { EducationFields } from '@/components/apply/EducationFields';
import type { WizardFormState } from '@/components/apply/types';

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-bg-card p-6 max-[480px]:p-5 [&>*:first-child]:mt-0">
      {title && <h3 className="mb-4 text-mono-label text-ink-3">{title}</h3>}
      {children}
    </section>
  );
}

/**
 * The applicant's details as editable fields, for corrections made before approving. Reuses the
 * wizard's own field components; holds no state — the review page owns the form and the errors.
 */
export function ApplicationProfileEditor({
  form,
  update,
  errors,
  setErrors,
  clearErrors,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  errors: Record<string, string>;
  setErrors: Dispatch<SetStateAction<Record<string, string>>>;
  clearErrors: (fields: string[]) => void;
}) {
  const set = (field: keyof WizardFormState, value: string) => {
    update({ [field]: value } as Partial<WizardFormState>);
    clearErrors([field]);
  };

  return (
    <div className="flex flex-col gap-4">
      <Section title="CONTACT">
        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            id="firstName"
            label="First name"
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
            error={errors.firstName}
          />
          <Input
            id="lastName"
            label="Last name"
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
            error={errors.lastName}
          />
          <Input
            id="contactEmail"
            label="Contact email"
            type="email"
            value={form.contactEmail}
            onChange={(e) => set('contactEmail', e.target.value)}
            error={errors.contactEmail}
          />
          <Input
            id="workEmail"
            label="Work email"
            type="email"
            value={form.workEmail}
            onChange={(e) => set('workEmail', e.target.value)}
            error={errors.workEmail}
          />
          <PhoneField
            countryCode={form.phoneCountryCode}
            phone={form.phone}
            onCountryCodeChange={(phoneCountryCode) => update({ phoneCountryCode })}
            onPhoneChange={(phone) => set('phone', phone)}
            error={errors.phone}
          />
          <Input
            id="linkedinUrl"
            label="LinkedIn URL"
            type="url"
            value={form.linkedinUrl}
            onChange={(e) => set('linkedinUrl', e.target.value)}
            error={errors.linkedinUrl}
          />
        </div>
      </Section>

      <Section title="LOCATION">
        <LocationFields
          form={form}
          update={update}
          countryError={errors.country}
          onCountryChange={() => clearErrors(['country'])}
        />
      </Section>

      <Section title="BIO">
        <Textarea
          id="bio"
          label="Professional bio"
          rows={5}
          maxLength={2000}
          autoGrow
          value={form.bio}
          onChange={(e) => set('bio', e.target.value)}
          error={errors.bio}
        />
      </Section>

      <Section title="HOURLY RATE (USD)">
        <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
          <Input
            id="rateMinDollars"
            label="Minimum"
            type="number"
            inputMode="numeric"
            value={form.rateMinDollars}
            onChange={(e) => set('rateMinDollars', e.target.value)}
            error={errors.rateMinDollars}
          />
          <Input
            id="rateMaxDollars"
            label="Maximum"
            type="number"
            inputMode="numeric"
            value={form.rateMaxDollars}
            onChange={(e) => set('rateMaxDollars', e.target.value)}
            error={errors.rateMaxDollars}
          />
        </div>
      </Section>

      <Section>
        <WorkHistoryFields
          form={form}
          update={update}
          errors={errors}
          setErrors={setErrors}
          clearErrors={clearErrors}
        />
        <EducationFields form={form} update={update} errors={errors} clearErrors={clearErrors} />
      </Section>
    </div>
  );
}
