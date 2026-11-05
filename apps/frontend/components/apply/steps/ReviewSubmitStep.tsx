'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { StepActions } from '@/components/apply/StepActions';
import { scrollToFirstError } from '@/components/apply/scrollToError';
import { FIRM_SIZES, REGIONS, TERMS_VERSION, PRIVACY_VERSION, type WizardFormState } from '@/components/apply/types';
import { USER_AGREEMENT_URL, PRIVACY_POLICY_URL, COOKIE_POLICY_URL } from '@/lib/consent';
import { previewCoupon } from '@/lib/api/applications';
import { ReviewRow, ReviewListRow, ReviewWorkHistoryRow } from '@/components/shared/ApplicationReview';
import { companyKey } from '@/lib/apply/company-websites';
import type { CouponPreviewResponse } from '@shared/membership-application';
import type { CategoryDto } from '@shared/category';
import { externalHref, externalLink } from '@/lib/members/format';
import { formatCents, formatDateRange } from '@/lib/apply/format';

type WorkRole = WizardFormState['workExperiences'][number];

/** Roles grouped per company, companies in order of first appearance (the form keeps newest first). */
function groupRolesByCompany(roles: WorkRole[]): WorkRole[][] {
  const groups = new Map<string, WorkRole[]>();
  roles.forEach((role, i) => {
    const key = companyKey(role.company) || `__unnamed-${i}`;
    groups.set(key, [...(groups.get(key) ?? []), role]);
  });
  return [...groups.values()];
}

const PRIORITY_LABEL: Record<1 | 2 | 3, string> = { 1: '1st preference', 2: '2nd preference', 3: '3rd preference' };

// Design-token colors only (no hardcoded hex) — a small, cohesive set rather than a full rainbow,
// matching the "premium, not gimmicky" bar the rest of this app holds to.
const CONFETTI_COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--ok)', 'var(--cta)', 'var(--ink)'];
const CONFETTI_PIECE_COUNT = 36;

// A one-shot celebratory burst for successfully applying a coupon — contained to whichever
// relatively-positioned card renders it, not a full-page overlay. Pure CSS animation (the
// `confetti-fall` keyframe in tailwind.config.ts); no new dependency for something this small.
function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_PIECE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.35,
        duration: 1.5 + Math.random() * 0.9,
        rotate: 90 + Math.random() * 270,
        drift: (Math.random() - 0.5) * 90,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    []
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 h-2.5 w-1.5 animate-confetti-fall rounded-[1px]"
          style={
            {
              left: `${p.left}%`,
              backgroundColor: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--confetti-drift': `${p.drift}px`,
              '--confetti-rotate': `${p.rotate}deg`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

// Header strip for one reviewed section, with an Edit link back to the wizard step that owns it.
// Entered data lives in the wizard's form state, so jumping back and forth loses nothing.
function SectionHeader({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-bg-alt px-6 py-3 max-[900px]:px-4">
      <span className="text-mono-label text-ink">{title}</span>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${title.toLowerCase()}`}
        className="rounded-input px-2 py-1 text-xs font-medium text-accent underline hover:text-ink"
      >
        Edit
      </button>
    </div>
  );
}

export function ReviewSubmitStep({
  form,
  update,
  categories,
  saving,
  saveError,
  onBack,
  onEditStep,
  suggestedCoupon = null,
  onSubmit,
}: {
  form: WizardFormState;
  update: (patch: Partial<WizardFormState>) => void;
  categories: CategoryDto[];
  saving?: boolean;
  saveError?: string | null;
  onBack: () => void;
  /** Jumps to a wizard step (2 = Identity, 3 = Background, 4 = Services) keeping entered data. */
  onEditStep: (step: number) => void;
  /**
   * Offered below the coupon field with its own Apply button — never applied automatically. When
   * set (pre-launch, or an invite link's code), a coupon must be applied before submitting.
   */
  suggestedCoupon?: string | null;
  /** `couponCode` is the code that was actually applied, or '' for none. */
  onSubmit: (opts: { couponCode: string }) => void;
}) {
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentPrivacy, setConsentPrivacy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The undiscounted price, fetched once (not per keystroke) — always the fallback display.
  const [basePrice, setBasePrice] = useState<CouponPreviewResponse | null>(null);
  // A coupon only takes effect once the applicant explicitly applies it — auto-validating on
  // every keystroke made a successful discount easy to miss (the price just quietly changed) and
  // gave no feedback at all for a bad code until you noticed the price hadn't moved.
  const [couponStatus, setCouponStatus] = useState<'idle' | 'applying' | 'success' | 'invalid'>('idle');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponPreviewResponse | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  // Pop-up shown when Submit is pressed before a coupon is applied. With a suggested code there is
  // no way past it without applying one; it stays open after a successful apply to submit from.
  const [couponPrompt, setCouponPrompt] = useState(false);

  const services = categories.flatMap((c) => c.services);
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;
  // "Tax › Direct Tax" — the same service name can sit under several categories, so the path is
  // what tells the applicant which one they picked.
  const servicePath = (id: string) => {
    const category = categories.find((c) => c.services.some((s) => s.id === id));
    return category ? `${category.serviceLineName} › ${category.name}` : '';
  };
  const regionLabel = REGIONS.find((r) => r.value === form.region)?.label ?? form.region;
  const location = [form.city, form.state, form.country].filter(Boolean).join(', ');

  function clearError(field: string) {
    setErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    previewCoupon({ billingPeriod: form.billingPeriod })
      .then((res) => {
        if (!cancelled) setBasePrice(res);
      })
      .catch(() => {
        if (!cancelled) setBasePrice(null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.billingPeriod]);

  async function handleApplyCoupon(codeToApply?: string) {
    const code = (codeToApply ?? form.couponCode).trim();
    if (!code || couponStatus === 'applying') return;
    if (code !== form.couponCode) update({ couponCode: code });
    setCouponStatus('applying');
    try {
      const res = await previewCoupon({ billingPeriod: form.billingPeriod, couponCode: code });
      if (res.valid && res.discountAmountCents > 0) {
        setAppliedCoupon(res);
        setCouponStatus('success');
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 2500);
      } else {
        setAppliedCoupon(null);
        setCouponStatus('invalid');
      }
    } catch {
      setAppliedCoupon(null);
      setCouponStatus('invalid');
    }
  }

  function handleCouponCodeChange(value: string) {
    update({ couponCode: value });
    // A previously applied/rejected code no longer describes what's now typed — back to idle
    // until they hit Apply again, rather than leaving a stale success/error showing.
    if (couponStatus !== 'idle') {
      setCouponStatus('idle');
      setAppliedCoupon(null);
    }
  }

  const displayedPrice = couponStatus === 'success' && appliedCoupon ? appliedCoupon : basePrice;
  const couponApplied = couponStatus === 'success';
  const couponRequired = Boolean(suggestedCoupon);
  // What the pop-up offers: the code they typed, else the one offered to them.
  const promptCode = form.couponCode.trim() || suggestedCoupon || '';
  const showSuggestion = Boolean(suggestedCoupon) && !couponApplied;
  const isFreeFromCoupon = couponStatus === 'success' && appliedCoupon?.amountDueCents === 0;

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!consentTerms) e.consentTerms = 'You must agree to the User Agreement to submit.';
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
    // A typed-but-unapplied code is caught too, so it's never silently dropped.
    if (!couponApplied && (couponRequired || form.couponCode.trim())) {
      setCouponPrompt(true);
      return;
    }
    submitWithAppliedCoupon();
  }

  function submitWithAppliedCoupon() {
    setCouponPrompt(false);
    onSubmit({ couponCode: couponApplied ? form.couponCode.trim() : '' });
  }

  return (
    <div>
      <h2 className="text-heading text-ink">Ready to submit.</h2>
      <p className="mt-2 text-lede text-ink-3">Review your details, then choose your membership plan.</p>

      <div className="mt-7 overflow-hidden rounded-2xl border border-line bg-bg-card divide-y divide-line">
        <SectionHeader title="Identity" onEdit={() => onEditStep(2)} />
        <div className="flex items-center gap-[18px] px-6 py-5 max-[900px]:flex-col max-[900px]:items-start max-[900px]:px-4 max-[900px]:py-6">
          <div className="flex h-24 w-24 flex-none items-center justify-center overflow-hidden rounded-full border-2 border-line-2 bg-bg-alt text-ink-3">
            {form.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                loading="lazy"
                decoding="async"
                src={form.photoUrl}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs">No photo</span>
            )}
          </div>
          <div>
            <div className="text-title text-ink">
              {form.firstName} {form.lastName}
            </div>
            <div className="mt-1 text-xs text-ink-3 [overflow-wrap:anywhere]">{form.contactEmail}</div>
          </div>
        </div>
        <ReviewRow label="Phone" value={form.phone ? `${form.phoneCountryCode} ${form.phone}` : '—'} />
        <ReviewRow label="Location" value={[location, regionLabel].filter(Boolean).join(' · ') || '—'} />
        <ReviewRow label="LinkedIn" value={form.linkedinUrl} href={externalHref(form.linkedinUrl) ?? undefined} />
        <ReviewRow label="Bio" value={form.bio} multiline />
        <SectionHeader title="Background" onEdit={() => onEditStep(3)} />
        <ReviewRow label="Experience" value={`${form.yearsOfExperience} years`} />
        <ReviewWorkHistoryRow
          label="Work history"
          companies={groupRolesByCompany(form.workExperiences.filter((w) => w.title.trim() || w.company.trim())).map(
            (roles) => {
              const firmSize = roles.find((w) => w.firmSize)?.firmSize;
              return {
                name: roles[0].company || 'Company not named',
                detail: firmSize ? `Firm size: ${FIRM_SIZES.find((f) => f.value === firmSize)?.label}` : undefined,
                link: externalLink(roles.find((w) => w.companyUrl)?.companyUrl, 'Website'),
                roles: roles.map((w) => ({
                  title: w.title,
                  detail: [formatDateRange(w.startMonth, w.startYear, w.isCurrent, w.endMonth, w.endYear), w.city]
                    .filter(Boolean)
                    .join(' · '),
                  body: w.description,
                })),
              };
            }
          )}
        />
        <ReviewListRow
          label="Education"
          items={form.educations
            .filter((e) => e.institution.trim() || e.degree.trim())
            .map((e) => ({
              title: e.fieldOfStudy ? `${e.degree} in ${e.fieldOfStudy}` : e.degree,
              detail: [
                e.institution,
                e.startYear || e.endYear ? `${e.startYear ?? '—'} – ${e.endYear ?? '—'}` : undefined,
              ]
                .filter(Boolean)
                .join(' · '),
            }))}
        />
        <ReviewListRow
          label="Peer references"
          items={form.peerReferences
            .filter((r) => r.name.trim())
            .map((r) => ({
              title: r.relationship ? `${r.name} — ${r.relationship}` : r.name,
              detail: [r.email, r.phone].filter(Boolean).join(' · '),
            }))}
        />
        <SectionHeader title="Services & rates" onEdit={() => onEditStep(4)} />
        <ReviewListRow
          label="Services"
          items={[...form.servicePreferences]
            .sort((a, b) => a.priority - b.priority)
            .map((p) => ({
              title: p.customLabel ? `${serviceName(p.serviceId)} (${p.customLabel})` : serviceName(p.serviceId),
              detail: [PRIORITY_LABEL[p.priority], servicePath(p.serviceId)].filter(Boolean).join(' · '),
            }))}
        />
        <ReviewRow label="Rate" value={`$${form.rateMinDollars} – $${form.rateMaxDollars} / hour`} />
      </div>

      <div className="mt-8 border-t border-line pt-6">
        <span className="text-mono-label text-ink-3">MEMBERSHIP PLAN</span>
        <p className="mt-1.5 text-sm text-ink-3">Billed annually — one plan, no tiers.</p>

        <div
          className={`relative mt-4 overflow-hidden rounded-2xl border p-5 transition-colors ${
            couponStatus === 'success' ? 'border-ok bg-ok/[0.06]' : 'border-ink bg-bg-alt'
          }`}
        >
          {showConfetti && <ConfettiBurst />}
          <div className="text-mono-label text-ink-3">Annual</div>
          <div className="mt-1.5 text-title text-ink">
            {!displayedPrice ? (
              'Loading…'
            ) : displayedPrice.discountAmountCents > 0 ? (
              <>
                <span className="mr-2 text-ink-3 line-through">{formatCents(displayedPrice.listPriceCents)}</span>
                {formatCents(displayedPrice.amountDueCents)}/year
              </>
            ) : (
              `${formatCents(displayedPrice.listPriceCents)}/year`
            )}
          </div>
          {couponStatus === 'success' && (
            <p className="relative mt-2 text-sm font-medium text-ok">
              🎉{' '}
              {isFreeFromCoupon
                ? "Congratulations — you've got your membership for free!"
                : `Coupon applied — you saved ${formatCents(appliedCoupon!.discountAmountCents)}!`}
            </p>
          )}
        </div>

        <div className="mt-5">
          {/* Input's own label+input+hint stacking can't share a row with a button — composed
              directly here using its exact input styling instead of forcing that component into
              a layout it doesn't support. */}
          <label htmlFor="couponCode" className="flex items-center justify-between text-xs font-medium text-ink-2">
            <span>Coupon code</span>
            <span className="font-normal text-ink-3">{couponRequired ? 'required' : 'optional'}</span>
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="couponCode"
              placeholder="Enter a code"
              value={form.couponCode}
              onChange={(e) => handleCouponCodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyCoupon();
                }
              }}
              aria-invalid={couponStatus === 'invalid' ? true : undefined}
              className={`w-full min-w-0 flex-1 rounded-input border px-3.5 py-3 text-sm text-ink placeholder:text-ink-4 focus:outline-none focus:ring-[3px] ${
                couponStatus === 'invalid'
                  ? 'border-error focus:border-error focus:ring-error/[0.08]'
                  : 'border-line focus:border-ink focus:ring-ink/[0.08]'
              }`}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleApplyCoupon()}
              disabled={!form.couponCode.trim() || couponStatus === 'applying'}
            >
              {couponStatus === 'applying' ? 'Applying…' : 'Apply'}
            </Button>
          </div>
          {couponStatus === 'invalid' ? (
            <span className="mt-1.5 block text-xs text-error">Invalid or expired coupon code.</span>
          ) : (
            <p className="mt-1.5 text-xs text-ink-3">Apply a coupon code to your order.</p>
          )}

          {showSuggestion && (
            <div className="mt-4 flex items-center justify-between gap-4 rounded-input border border-dashed border-accent bg-[color-mix(in_oklab,var(--accent)_6%,transparent)] px-4 py-3 max-sm:flex-col max-sm:items-stretch">
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">
                  Founding member code{' '}
                  <span className="rounded bg-bg-card px-1.5 py-0.5 font-mono text-mono-label text-accent">
                    {suggestedCoupon}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-3">Your first year of membership, complimentary.</p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleApplyCoupon(suggestedCoupon!)}
                disabled={couponStatus === 'applying'}
              >
                {couponStatus === 'applying' ? 'Applying…' : 'Apply'}
              </Button>
            </div>
          )}
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
                onChange={(e) => {
                  setConsentTerms(e.target.checked);
                  clearError('consentTerms');
                }}
              />
              <span className="text-ink-2">
                I agree to the{' '}
                <a
                  href={USER_AGREEMENT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline hover:text-ink"
                  onClick={(e) => e.stopPropagation()}
                >
                  User Agreement
                </a>{' '}
                (v{TERMS_VERSION}).
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
                onChange={(e) => {
                  setConsentPrivacy(e.target.checked);
                  clearError('consentPrivacy');
                }}
              />
              <span className="text-ink-2">
                I agree to the{' '}
                <a
                  href={PRIVACY_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline hover:text-ink"
                  onClick={(e) => e.stopPropagation()}
                >
                  Privacy Policy
                </a>{' '}
                (v{PRIVACY_VERSION}).
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
                onChange={(e) => {
                  update({ backgroundCheckConsent: e.target.checked });
                  clearError('backgroundCheckConsent');
                }}
              />
              <span className="text-ink-2">
                I consent to GrowXQ verifying my professional credentials and background as part of the membership
                review process. By continuing, you acknowledge our{' '}
                <a
                  href={COOKIE_POLICY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline hover:text-ink"
                  onClick={(e) => e.stopPropagation()}
                >
                  Cookie Policy
                </a>
                .
              </span>
            </label>
            {errors.backgroundCheckConsent && (
              <p className="mt-1 text-xs text-error">{errors.backgroundCheckConsent}</p>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={couponPrompt}
        onClose={() => setCouponPrompt(false)}
        title={couponApplied ? 'Coupon applied' : 'Apply your coupon code'}
      >
        {couponApplied ? (
          <>
            <p className="text-sm text-ink-2">
              🎉{' '}
              {isFreeFromCoupon
                ? 'Your first year of membership is complimentary.'
                : `You saved ${formatCents(appliedCoupon!.discountAmountCents)}.`}{' '}
              You can submit your application now.
            </p>
            <div className="mt-6 flex justify-end max-sm:flex-col">
              <Button type="button" onClick={submitWithAppliedCoupon} disabled={saving}>
                {saving ? 'Submitting…' : 'Submit application'}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              {couponRequired
                ? 'A coupon code must be applied before you submit your application.'
                : 'You entered a coupon code but haven’t applied it yet.'}
            </p>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-input border border-dashed border-accent bg-[color-mix(in_oklab,var(--accent)_6%,transparent)] px-4 py-3">
              <span className="font-mono text-mono-label text-accent">{promptCode}</span>
              <Button
                type="button"
                size="sm"
                onClick={() => handleApplyCoupon(promptCode)}
                disabled={couponStatus === 'applying'}
              >
                {couponStatus === 'applying' ? 'Applying…' : 'Apply'}
              </Button>
            </div>
            {couponStatus === 'invalid' && (
              <p className="mt-2 text-xs text-error">
                That code is invalid or expired.
                {couponRequired && suggestedCoupon !== promptCode ? ` Try ${suggestedCoupon} instead.` : ''}
              </p>
            )}
            {couponRequired && suggestedCoupon !== promptCode && couponStatus === 'invalid' && (
              <div className="mt-3">
                <Button type="button" size="sm" variant="secondary" onClick={() => handleApplyCoupon(suggestedCoupon!)}>
                  Apply {suggestedCoupon}
                </Button>
              </div>
            )}
          </>
        )}
      </Modal>

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
