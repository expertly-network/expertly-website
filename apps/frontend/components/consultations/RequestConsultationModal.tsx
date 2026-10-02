'use client';

import { useEffect, useState } from 'react';
import { Modal, Input, Select, Textarea, Button } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { checkConsultationEligibility, createConsultation } from '@/lib/api/consultations';
import { getMyContact } from '@/lib/api/account';
import { ApiError } from '@/lib/api/client';
// Reused as-is from the membership application form — same compound country-code + number
// field, same data source, rather than inventing a second phone-input convention.
import { PHONE_COUNTRY_CODES } from '@/components/apply/types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTHER_VALUE = '__other__';
const MIN_MESSAGE_LENGTH = 100;
// Includes time, not just the date — a rate-limit reset can be hours away on the same day, not
// just another calendar day out like the pending-cooldown case usually is.
const RETRY_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

// A saved dial code (e.g. "+1") doesn't uniquely identify a country — several share one — so
// reversing it for prefill needs a tiebreak. Only the one case we've actually seen cause visible
// confusion (+1 landing on "American Samoa") gets an explicit preference; everything else falls
// back to the first match, which is an acceptable "close enough, user can correct it" default for
// a convenience prefill rather than a required selection.
const PREFERRED_COUNTRY_FOR_DIAL_CODE: Record<string, string> = { '+1': 'United States' };

function countryForDialCode(code: string): string {
  const preferred = PREFERRED_COUNTRY_FOR_DIAL_CODE[code];
  if (preferred && PHONE_COUNTRY_CODES.some((c) => c.country === preferred && c.code === code)) {
    return preferred;
  }
  return PHONE_COUNTRY_CODES.find((c) => c.code === code)?.country ?? '';
}

export interface RequestConsultationService {
  id: string;
  name: string;
  categoryName: string;
}

export function RequestConsultationModal({
  memberId,
  memberName,
  services,
  prefillName,
  prefillEmail,
  open,
  onClose,
}: {
  memberId: string;
  memberName: string;
  services: RequestConsultationService[];
  prefillName?: string;
  prefillEmail?: string;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(prefillName ?? '');
  const [email, setEmail] = useState(prefillEmail ?? '');
  // Keyed by country name, not dial code — several countries share a code (e.g. +1 is the US,
  // Canada, and a dozen Caribbean nations), so keying a <select> by code alone means its `value`
  // silently resolves to whichever one happens to come first alphabetically (was landing on
  // "American Samoa" for the common "+1" case) rather than anything the user actually chose.
  const [phoneCountry, setPhoneCountry] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [serviceChoice, setServiceChoice] = useState('');
  const [customService, setCustomService] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Only for submission-time failures (network/server errors, 401) — client-side "this field
  // needs fixing" is shown per-field below instead of as one generic banner.
  const [error, setError] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [sent, setSent] = useState(false);
  // Stays false until the first submit attempt, then every invalid field shows its own red
  // border + message, live, as the user fixes each one — not shown on an untouched form.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  // Checked before the form is even shown — see the effect below. Starts true so the form never
  // flashes before the check resolves.
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [blockedReason, setBlockedReason] = useState<'pending' | 'rate_limited' | null>(null);
  const [blockedRetryAfter, setBlockedRetryAfter] = useState<string | null>(null);

  function reset() {
    setName(prefillName ?? '');
    setEmail(prefillEmail ?? '');
    setPhoneCountry('');
    setPhoneNumber('');
    setServiceChoice('');
    setCustomService('');
    setMessage('');
    setError(null);
    setNeedsSignIn(false);
    setSent(false);
    setAttemptedSubmit(false);
    setCheckingEligibility(true);
    setBlockedReason(null);
    setBlockedRetryAfter(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  // Lazy, not eager — most page visitors never open this modal, so fetching this on every page
  // load (alongside name/email, which are already-available session data, not a DB round trip)
  // would be wasted work. Fires once per open; `reset()` already clears these fields on close, so
  // a reopen naturally re-fetches fresh rather than ever overwriting something the user typed.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getMyContact()
      .then((contact) => {
        if (cancelled || !contact.phone) return;
        setPhoneNumber(contact.phone);
        if (contact.phoneCountryCode) setPhoneCountry(countryForDialCode(contact.phoneCountryCode));
      })
      .catch(() => {
        // Not signed in, or no saved phone — nothing to prefill, not an error worth surfacing.
      });
    // Tells the user up front if they're already blocked — a pending request to this member, or
    // the daily rate limit — instead of letting them fill out the whole form and only finding out
    // on submit. If the check itself fails (network blip, not signed in), fail open — the form
    // still shows, and create() still enforces the real rules server-side either way.
    checkConsultationEligibility(memberId)
      .then((result) => {
        if (cancelled) return;
        setBlockedReason(result.blocked ? result.reason : null);
        setBlockedRetryAfter(result.blocked ? result.retryAfter : null);
      })
      .catch(() => {
        if (!cancelled) {
          setBlockedReason(null);
          setBlockedRetryAfter(null);
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingEligibility(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, memberId]);

  const isOther = serviceChoice === OTHER_VALUE;
  const nameValid = Boolean(name.trim());
  const emailValid = EMAIL_RE.test(email.trim());
  const phoneValid = Boolean(phoneCountry) && Boolean(phoneNumber.trim());
  const serviceSelectValid = Boolean(serviceChoice);
  const customServiceValid = !isOther || Boolean(customService.trim());
  const messageValid = message.trim().length >= MIN_MESSAGE_LENGTH;
  const canSubmit =
    nameValid &&
    emailValid &&
    phoneValid &&
    serviceSelectValid &&
    customServiceValid &&
    messageValid &&
    !submitting;

  // Only rendered once attemptedSubmit is true (see the Button below) — each one is `undefined`
  // when the field is already valid, so a field's red border/message clears the moment it's fixed.
  const nameError = !nameValid ? 'Your name is required.' : undefined;
  const emailError = !emailValid ? 'Enter a valid email address.' : undefined;
  const phoneError = !phoneValid
    ? !phoneCountry && !phoneNumber.trim()
      ? 'Select a country code and enter your mobile number.'
      : !phoneCountry
        ? 'Select a country code.'
        : 'Enter your mobile number.'
    : undefined;
  const serviceError = !serviceSelectValid ? 'Please select a service, or choose "Other".' : undefined;
  const customServiceError = !customServiceValid ? 'Please describe the service.' : undefined;
  const messageError = !messageValid
    ? message.trim().length === 0
      ? 'Please describe what you need help with.'
      : `Add at least ${MIN_MESSAGE_LENGTH} characters (currently ${message.trim().length}).`
    : undefined;

  async function handleSubmit() {
    setAttemptedSubmit(true);
    if (!canSubmit) return;
    setError(null);
    setNeedsSignIn(false);
    setSubmitting(true);
    try {
      const dialCode = PHONE_COUNTRY_CODES.find((c) => c.country === phoneCountry)?.code ?? '';
      await createConsultation({
        memberId,
        name: name.trim(),
        email: email.trim(),
        // consultation_requests.requester_phone is a single text column (same shape as
        // member_profiles.contact_phone) — combine client-side rather than adding a schema
        // column, matching ApplicationsService's `${phoneCountryCode} ${phone}`.trim() convention.
        phone: `${dialCode} ${phoneNumber.trim()}`.trim(),
        message: message.trim(),
        ...(isOther
          ? { customServiceLabel: customService.trim() }
          : { serviceId: serviceChoice }),
      });
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        setNeedsSignIn(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={handleClose} title="Request Consultation" size="lg">
      {checkingEligibility ? (
        <div className="flex items-center justify-center py-12">
          <span className="text-sm text-ink-3">Checking availability…</span>
        </div>
      ) : blockedReason ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
          </div>
          {blockedReason === 'pending' ? (
            <>
              <p className="text-title text-ink">Request Already Pending</p>
              <p className="text-sm text-ink-3">
                You already have a pending request with {memberName}. They haven&apos;t responded yet
                — you can send a new one once they do, or after{' '}
                {blockedRetryAfter && RETRY_DATE_FORMAT.format(new Date(blockedRetryAfter))} if they
                haven&apos;t by then.
              </p>
            </>
          ) : (
            <>
              <p className="text-title text-ink">Too Many Requests Today</p>
              <p className="text-sm text-ink-3">
                You&apos;ve reached the limit on consultation requests for now. You can send another
                after{' '}
                {blockedRetryAfter && RETRY_DATE_FORMAT.format(new Date(blockedRetryAfter))}.
              </p>
            </>
          )}
          <Button onClick={handleClose} className="mt-2">
            Close
          </Button>
        </div>
      ) : sent ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--ok)_12%,transparent)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12l5 5L20 7" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-title text-ink">Request Sent</p>
          <p className="text-sm text-ink-3">
            Your consultation request has been sent to {memberName}. They&apos;ll respond to you directly.
          </p>
          <Button onClick={handleClose} className="mt-2">
            Close
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="-mt-2 text-sm text-ink-3">with {memberName}</p>
          <Input
            label="Your Name"
            placeholder="e.g. Amelia Ross"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            error={attemptedSubmit ? nameError : undefined}
          />
          <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@firm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              error={attemptedSubmit ? emailError : undefined}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone-country" className="text-xs font-medium text-ink-2">
                Mobile Number
              </label>
              {/* One visual control, not two glued-together ones: `focus-within` puts the ring on
                  the shared wrapper regardless of which inner element has focus, and both inner
                  elements are bg-transparent so the wrapper's own background reads as continuous.
                  Same red-border-on-error convention as Input/Select, just hand-built since this
                  compound field isn't backed by either of those components. */}
              <div
                className={`flex items-stretch rounded-input border bg-bg focus-within:ring-[3px] ${
                  attemptedSubmit && phoneError
                    ? 'border-error focus-within:border-error focus-within:ring-error/[0.08]'
                    : 'border-line focus-within:border-ink focus-within:ring-ink/[0.08]'
                }`}
              >
                <select
                  id="phone-country"
                  className="w-[9.5rem] flex-none border-r border-line bg-transparent py-3 pl-3 pr-6 text-sm text-ink outline-none"
                  value={phoneCountry}
                  onChange={(e) => setPhoneCountry(e.target.value)}
                >
                  <option value="" disabled>
                    Country code
                  </option>
                  {PHONE_COUNTRY_CODES.map(({ country, code }) => (
                    <option key={country} value={country}>
                      {country} ({code})
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  placeholder="212 555 0148"
                  className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm text-ink placeholder:text-ink-4 outline-none"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  maxLength={25}
                />
              </div>
              {attemptedSubmit && phoneError && <span className="text-xs text-error">{phoneError}</span>}
            </div>
          </div>
          <Select
            label="Service"
            value={serviceChoice}
            onChange={(e) => setServiceChoice(e.target.value)}
            error={attemptedSubmit ? serviceError : undefined}
          >
            <option value="" disabled>
              Select a service…
            </option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.categoryName} — {service.name}
              </option>
            ))}
            <option value={OTHER_VALUE}>Other</option>
          </Select>
          {isOther && (
            <Input
              label="Describe the service"
              placeholder="e.g. Cross-border estate planning"
              value={customService}
              onChange={(e) => setCustomService(e.target.value)}
              maxLength={150}
              error={attemptedSubmit ? customServiceError : undefined}
            />
          )}
          <Textarea
            label="Description of Work Required"
            placeholder="Describe what you need help with, in as much detail as possible…"
            rows={6}
            maxLength={2000}
            error={attemptedSubmit ? messageError : undefined}
            hint={
              <>
                Mention what you need help with, relevant background, and your timeline — 2-3
                sentences gives {memberName.split(' ')[0]} enough to respond quickly.{' '}
                {/* Neutral until they've actually started typing — an untouched field isn't an
                    error yet, it just hasn't been attempted. */}
                <span
                  className={
                    message.length > 0 && message.trim().length < MIN_MESSAGE_LENGTH ? 'text-error' : undefined
                  }
                >
                  {message.length} / 2000 ({MIN_MESSAGE_LENGTH} minimum)
                </span>
              </>
            }
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {needsSignIn ? (
            <div
              role="alert"
              className="rounded-[10px] border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
            >
              Please sign in to request a consultation.{' '}
              <a
                href={`/login?returnTo=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}
                className="font-medium underline"
              >
                Sign in
              </a>
            </div>
          ) : (
            error && <ErrorBanner message={error} />
          )}
          <div className="flex gap-2">
            <Button onClick={handleSubmit} disabled={submitting} fullWidth>
              {submitting ? 'Sending…' : 'Send Request'}
            </Button>
            <Button variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
