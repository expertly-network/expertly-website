import type { ReactNode } from 'react';
import Link from 'next/link';
import { PRIVACY_POLICY_URL } from '@/lib/legal';

export interface LegalDoc {
  title: string;
  /** Final copy hasn't been through legal review yet — the page says so prominently. */
  draft: boolean;
  body: ReactNode;
}

// PLACEHOLDER COPY — replace each `body` with the reviewed legal text (and flip `draft` to false).
// Kept as JSX rather than fetched HTML so it renders with the site's own typography.
export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terms: {
    title: 'Terms & Conditions',
    draft: true,
    body: (
      <p>
        By using GrowXQ, you agree to these Terms &amp; Conditions. The full terms are being finalised
        with legal review and will be published here.
      </p>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    draft: true,
    body: (
      <p>
        This Privacy Policy describes how GrowXQ collects, uses, and protects your information. The full
        policy is being finalised with legal review and will be published here.
      </p>
    ),
  },
  'membership-policy': {
    title: 'Membership Policy',
    draft: true,
    body: (
      <p>
        This Membership Policy sets out how members are vetted and verified, the standards of conduct
        expected of members, and how membership is renewed or ended. The full policy is being finalised
        with legal review and will be published here.
      </p>
    ),
  },
  'linkedin-data-use': {
    title: 'LinkedIn Profile Data Use',
    draft: true,
    body: (
      <>
        <p>
          When you provide a LinkedIn profile URL during your membership application, GrowXQ reads the
          publicly visible sections of that profile — your name, professional summary, profile photo, work
          history (job titles, employers, locations, dates and role descriptions), and education
          (institutions, degrees, fields of study, years) — and uses them to pre-fill the matching fields
          of your application.
        </p>
        <p>
          Nothing is published automatically. Every pre-filled field is shown to you for review before you
          submit, and you can edit or remove any of it, including replacing the photo. If your application
          is approved, the information you leave in place becomes part of your public member profile.
        </p>
        <p>
          Connecting your LinkedIn account (the &ldquo;Connect your LinkedIn&rdquo; step) verifies your
          identity and is covered by LinkedIn&apos;s own authorization screen, not by this consent.
        </p>
        <p>
          Providing a LinkedIn profile URL for this import is optional — you can decline and enter all of
          your information manually instead.
        </p>
        <p>
          See our{' '}
          <Link href={PRIVACY_POLICY_URL} className="text-accent underline underline-offset-2">
            Privacy Policy
          </Link>{' '}
          for how this data is stored and protected.
        </p>
      </>
    ),
  },
};
