import { ApiError } from '@/lib/api/errors';

// Client-side twins of the backend's save-time rules for the fields an applicant types by hand, so
// a bad value is caught under its own field instead of failing the whole draft save.
/** Close enough to class-validator's isEmail for the mistakes people actually make (no TLD, spaces). */
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Same as the backend's LINKEDIN_PROFILE_URL_PATTERN (applications/dto/linkedin-import-request.dto.ts). */
export const LINKEDIN_PROFILE_URL_PATTERN =
  /^(https?:\/\/)?([a-z]{2,3}\.|www\.)?linkedin\.com\/in\/[^\s/?#]+\/?([?#]\S*)?$/i;

const FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  contactEmail: 'Contact email',
  workEmail: 'Work email',
  phone: 'Phone number',
  phoneCountryCode: 'Phone country code',
  region: 'Location',
  country: 'Location',
  state: 'Location',
  city: 'Location',
  linkedinUrl: 'LinkedIn URL',
  bio: 'Professional bio',
  yearsOfExperience: 'Years of experience',
  servicePreferences: 'Services',
  rateMinCents: 'Hourly rate',
  rateMaxCents: 'Hourly rate',
  couponCode: 'Coupon code',
};
const LIST_LABELS: Record<string, string> = {
  workExperiences: 'Work experience',
  educations: 'Education',
  peerReferences: 'Reference',
};

/**
 * Turns a VALIDATION_FAILED save into "Please check: Contact email, Reference 1." — the backend's
 * messages lead with the raw field path ("contactEmail must be an email",
 * "peerReferences.0.email must be an email"), which is never shown as-is. Null when none of them
 * names a field we know, so the caller falls back to its generic copy.
 */
export function validationFieldsMessage(err: unknown): string | null {
  if (!(err instanceof ApiError) || err.code !== 'VALIDATION_FAILED') return null;
  const labels = new Set<string>();
  for (const message of err.messages) {
    const [path] = message.split(' ');
    const [field, index] = path.split('.');
    if (FIELD_LABELS[field]) labels.add(FIELD_LABELS[field]);
    else if (LIST_LABELS[field])
      labels.add(index && /^\d+$/.test(index) ? `${LIST_LABELS[field]} ${Number(index) + 1}` : LIST_LABELS[field]);
  }
  return labels.size > 0 ? `Please check: ${[...labels].join(', ')}.` : null;
}
