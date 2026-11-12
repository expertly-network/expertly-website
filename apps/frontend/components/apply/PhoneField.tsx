'use client';

import { FIELD_FOCUS_WITHIN } from '@/components/ui/field-styles';
import { PHONE_COUNTRY_CODES } from '@/components/apply/types';

/** Country code + number in one bordered field. Used by the wizard and the admin review editor. */
export function PhoneField({
  countryCode,
  phone,
  onCountryCodeChange,
  onPhoneChange,
  error,
}: {
  countryCode: string;
  phone: string;
  onCountryCodeChange: (code: string) => void;
  onPhoneChange: (phone: string) => void;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="phone" className="text-xs font-medium text-ink-2">
        WhatsApp / Phone
        <span aria-hidden="true" className="text-error">
          {' '}
          *
        </span>
      </label>
      <div
        className={`flex overflow-hidden rounded-input border ${
          error ? 'border-error' : `border-line ${FIELD_FOCUS_WITHIN}`
        }`}
      >
        <select
          aria-label="Phone country code"
          className="max-w-[9.5rem] border-r border-line bg-bg-alt px-2 text-xs text-ink outline-none"
          value={countryCode}
          onChange={(e) => onCountryCodeChange(e.target.value)}
        >
          {PHONE_COUNTRY_CODES.map(({ country, code }) => (
            <option key={country} value={code}>
              {country} ({code})
            </option>
          ))}
        </select>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'phone-error' : undefined}
          placeholder="7700 900 000"
          className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm text-ink outline-none"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
        />
      </div>
      {error && (
        <span id="phone-error" className="text-xs text-error">
          {error}
        </span>
      )}
    </div>
  );
}
