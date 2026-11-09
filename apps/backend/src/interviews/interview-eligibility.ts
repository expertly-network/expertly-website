import type { InterviewEligibility } from '@shared/interview';
import type { InterviewRow } from './interviews.repository';

export function eligibilityOf(
  interview: InterviewRow | null,
  hasLiveConnection: boolean,
  nowMs: number,
  maxSeconds: number
): InterviewEligibility {
  if (!interview) return 'available';
  switch (interview.status) {
    case 'voided':
      return 'available';
    case 'ready':
      return hasLiveConnection ? 'in_progress' : 'available';
    case 'in_progress':
      return hasLiveConnection ? 'in_progress' : 'can_reconnect';
    case 'interrupted': {
      const open =
        interview.reconnectUntil !== null &&
        nowMs < Date.parse(interview.reconnectUntil) &&
        interview.elapsedSeconds < maxSeconds;
      return open ? 'can_reconnect' : 'processing';
    }
    case 'processing':
    case 'completed':
    case 'failed':
      return interview.status;
  }
}
