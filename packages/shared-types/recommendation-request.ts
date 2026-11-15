// A member asking another member for a recommendation. Fulfilled automatically when the recipient
// posts a recommendation for the requester; "ignored" is a silent decline the requester never sees
// (they just keep seeing "Requested"); "cancelled" is the requester withdrawing the request.
export type RecommendationRequestStatus = 'pending' | 'fulfilled' | 'ignored' | 'cancelled';

export interface RecommendationRequestPerson {
  id: string;
  slug: string;
  name: string;
  photoUrl: string | null;
  headline: string | null;
}

export interface RecommendationRequestDto {
  id: string;
  requester: RecommendationRequestPerson;
  recipient: RecommendationRequestPerson;
  message: string | null;
  /** The requester never sees 'ignored': it is reported to them as 'pending'. */
  status: RecommendationRequestStatus;
  createdAt: string;
  respondedAt: string | null;
}

// POST /v1/members/:id/recommendation-requests — :id is the member being asked.
export interface CreateRecommendationRequestRequest {
  message?: string;
}

// PATCH /v1/recommendation-requests/:requestId
export interface UpdateRecommendationRequestRequest {
  /** Recipient: 'ignore'. Requester: 'cancel'. */
  action: 'ignore' | 'cancel';
}
