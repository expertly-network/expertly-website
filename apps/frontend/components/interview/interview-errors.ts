import { apiErrorMessage } from '@/lib/errors/api-error-message';

// Thrown locally (not by the API) when the browser cannot open a microphone.
export class MicBlockedError extends Error {
  constructor(
    readonly reason?: string,
    readonly detail?: string
  ) {
    super('MIC_BLOCKED');
  }
}

const BY_CODE: Readonly<Record<string, string>> = {
  INTERVIEW_NOT_ELIGIBLE: 'The expert interview is available to active members only.',
  INTERVIEW_PROVIDER_UNAVAILABLE: 'The interview service is unavailable right now. Please try again in a few minutes.',
  CONSENT_VERSION_MISMATCH: 'The interview terms were updated. Please refresh the page and review them.',
  INTERVIEW_IN_PROGRESS: 'Your interview is already open in another window or device.',
  INTERVIEW_ALREADY_TAKEN: 'You have already taken your interview.',
  INTERVIEW_TIME_EXHAUSTED: 'Your interview time has been used.',
  INTERVIEW_NOT_COMPLETED: 'Your interview results are not ready yet.',
  INTERVIEW_SUMMARY_HIDDEN: 'This summary has been hidden by the GrowXQ team.',
  INTERVIEW_LLM_ERROR: 'We couldn’t prepare your interview just now. Please try again in a minute.',
};

export function interviewErrorMessage(error: unknown): string {
  if (error instanceof MicBlockedError) {
    if (error.reason === 'NotFoundError' || error.reason === 'DevicesNotFoundError')
      return 'No microphone was found. Connect or select an input device, then try again.';
    if (error.reason === 'NotReadableError' || error.reason === 'TrackStartError')
      return 'Chrome could not open the microphone. Close other apps using it, then try again.';
    if (process.env.NODE_ENV !== 'production' && error.reason)
      return `Microphone check failed (${error.reason}${error.detail ? `: ${error.detail}` : ''}).`;
    return 'We need your microphone for the interview. Allow microphone access in your browser settings, then try again.';
  }
  return apiErrorMessage(error, 'Something went wrong. Please try again.', BY_CODE);
}
