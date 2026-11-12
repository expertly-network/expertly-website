import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InterviewProposedServiceDto } from './subtags';

const INTERVIEW_STATUSES = ['ready', 'in_progress', 'interrupted', 'processing', 'completed', 'failed', 'voided'];
export type InterviewStatus =
  | 'ready'
  | 'in_progress'
  | 'interrupted'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'voided';

const INTERVIEW_ELIGIBILITIES = ['available', 'in_progress', 'can_reconnect', 'processing', 'completed', 'failed'];
export type InterviewEligibility =
  | 'available'
  | 'in_progress'
  | 'can_reconnect'
  | 'processing'
  | 'completed'
  | 'failed';

const SUMMARY_STATUSES = ['pending', 'approved', 'hidden'];
export type InterviewSummaryStatus = 'pending' | 'approved' | 'hidden';

export class InterviewDraftEngagement {
  @ApiProperty() title!: string;
  @ApiProperty() organization!: string;
  /** Null unless the member named the client and it isn't under NDA; the edit form makes them fill it. */
  @ApiProperty({ nullable: true, type: String }) clientName!: string | null;
  @ApiProperty({ nullable: true, type: Number }) year!: number | null;
}

export class InterviewDraftKeyClient {
  @ApiProperty() name!: string;
}

export class InterviewHeadlineBioDraft {
  @ApiProperty() headline!: string;
  @ApiProperty() bio!: string;
}

/** Shapes match the existing member edit sections (POST /v1/members/:id/edits). */
export class InterviewDrafts {
  @ApiPropertyOptional({ type: () => InterviewHeadlineBioDraft }) headlineBio?: InterviewHeadlineBioDraft;
  @ApiPropertyOptional({ type: () => InterviewDraftEngagement, isArray: true })
  engagements?: InterviewDraftEngagement[];
  @ApiPropertyOptional({ type: () => InterviewDraftKeyClient, isArray: true }) keyClients?: InterviewDraftKeyClient[];
}

export class MyInterviewDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: INTERVIEW_STATUSES }) status!: InterviewStatus;
  @ApiProperty() elapsedSeconds!: number;
  @ApiProperty({ nullable: true, type: String }) reconnectUntil!: string | null;
  @ApiProperty({ nullable: true, type: String }) endedAt!: string | null;
  @ApiProperty({ nullable: true, type: () => InterviewDrafts }) drafts!: InterviewDrafts | null;
  @ApiProperty({ nullable: true, type: String }) summary!: string | null;
  @ApiProperty({ nullable: true, enum: SUMMARY_STATUSES }) summaryStatus!: InterviewSummaryStatus | null;
  /** Proposed sub-tags per service; empty until completed. Never includes scores. */
  @ApiProperty({ type: () => InterviewProposedServiceDto, isArray: true })
  proposedServices!: InterviewProposedServiceDto[];
  /** True when the interview evidenced at least one claim (drives the "Interview-verified" mark). */
  @ApiProperty() verified!: boolean;
}

// GET /v1/interviews/me. Never includes plan, state, assessment or audio.
export class MyInterviewResponse {
  @ApiProperty({ enum: INTERVIEW_ELIGIBILITIES }) eligibility!: InterviewEligibility;
  @ApiProperty({ nullable: true, type: () => MyInterviewDto }) interview!: MyInterviewDto | null;
  @ApiProperty() consentVersion!: string;
  /** Hard cap for the whole interview, in seconds (1020). */
  @ApiProperty() maxSeconds!: number;
}

export class StartInterviewRequest {
  @ApiProperty() consentVersion!: string;
  /** Keep the call recording after scoring. Defaults to false (audio deleted). */
  @ApiPropertyOptional() audioOptIn?: boolean;
}

export class StartInterviewResponse {
  @ApiProperty() interviewId!: string;
  @ApiProperty() connectionId!: string;
  /** ElevenLabs WebRTC conversation token, minted server-side. */
  @ApiProperty() conversationToken!: string;
  /** Pass to the SDK as customLlmExtraBody.sessionToken AND dynamicVariables.session_token. */
  @ApiProperty() sessionToken!: string;
  /** Remaining wall-clock budget for this connection, ≤ 1020. */
  @ApiProperty() maxSeconds!: number;
}

export class UpdateInterviewSummaryRequest {
  @ApiProperty() summary!: string;
  @ApiProperty() approve!: boolean;
}

export class InterviewTranscriptTurn {
  @ApiProperty({ enum: ['agent', 'user'] }) role!: 'agent' | 'user';
  @ApiProperty() message!: string;
  /** Seconds from the start of that connection. */
  @ApiProperty({ nullable: true, type: Number }) timeInCallSecs!: number | null;
}

export const SIGNAL_NAMES = [
  'specificity',
  'sequence',
  'friction',
  'constraints',
  'i_we_split',
  'third_party',
  'variation',
  'boundary',
  'consistency',
  'depth_gradient',
] as const;
export type SignalName = (typeof SIGNAL_NAMES)[number];
export const EVIDENCE_LEVELS = ['E3', 'E2', 'E1', 'E0', 'EX', 'NP'] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];
export const REVIEW_FLAG_REASONS = [
  'unsupported',
  'contradicted',
  'anchor_conflict',
  'firm_level_on_selected',
  'technical_unverified',
] as const;
export type ReviewFlagReason = (typeof REVIEW_FLAG_REASONS)[number];
export const REVIEW_FLAG_STATUSES = ['open', 'dismissed', 'confirmed'] as const;
export type ReviewFlagStatus = (typeof REVIEW_FLAG_STATUSES)[number];

export class InterviewSignalDto {
  @ApiProperty({ enum: ['supports', 'weakens', 'not_tested'] }) rating!: 'supports' | 'weakens' | 'not_tested';
  /** 1-based turn number in the merged transcript. */
  @ApiProperty({ nullable: true, type: Number }) turn!: number | null;
  @ApiProperty({ nullable: true, type: String }) quote!: string | null;
}

export class InterviewTechnicalNoteDto {
  @ApiProperty({ enum: ['anchor_match', 'anchor_conflict', 'technical_unverified'] })
  kind!: 'anchor_match' | 'anchor_conflict' | 'technical_unverified';
  @ApiProperty() turn!: number;
  @ApiProperty() quote!: string;
}

export class InterviewClaimFacetsDto {
  @ApiProperty({ type: String, isArray: true }) jurisdiction!: string[];
  @ApiProperty({ type: String, isArray: true }) instrument!: string[];
  @ApiProperty({ type: String, isArray: true }) work_type!: string[];
  @ApiProperty({ type: String, isArray: true }) forum!: string[];
  @ApiProperty({ type: String, isArray: true }) client_type!: string[];
  @ApiProperty({ type: String, isArray: true }) industry!: string[];
  @ApiProperty({ type: String, isArray: true }) scale!: string[];
  @ApiProperty({ type: String, isArray: true }) volume!: string[];
  @ApiProperty({ nullable: true, type: Number }) recencyYear!: number | null;
}

/** Admin-only. Evidence is recomputed in code from the signals; modelEvidence is the model's own call. */
export class InterviewClaimScoreDto {
  @ApiProperty() claimId!: string;
  @ApiProperty() claimText!: string;
  @ApiProperty({ type: String, isArray: true }) serviceIds!: string[];
  @ApiProperty() probed!: boolean;
  @ApiProperty({ nullable: true, type: Number }) role!: number | null;
  @ApiProperty({ enum: EVIDENCE_LEVELS }) evidence!: EvidenceLevel;
  @ApiProperty({ enum: EVIDENCE_LEVELS }) modelEvidence!: EvidenceLevel;
  @ApiProperty({ type: Object }) signals!: Record<SignalName, InterviewSignalDto>;
  @ApiProperty({ type: () => InterviewTechnicalNoteDto, isArray: true }) technical!: InterviewTechnicalNoteDto[];
  @ApiProperty({ type: String, isArray: true }) lowConfidenceTerms!: string[];
  @ApiProperty({ type: () => InterviewClaimFacetsDto }) facets!: InterviewClaimFacetsDto;
  @ApiProperty({ type: String, isArray: true }) creditServiceIds!: string[];
  @ApiProperty({ type: String, isArray: true }) candidateSubtags!: string[];
  @ApiProperty() evidenceSummary!: string;
}

export class InterviewQualityDto {
  @ApiProperty() minutes!: number;
  @ApiProperty() claimsProbed!: number;
  @ApiProperty() endedEarly!: boolean;
}

export class InterviewScoringResultDto {
  @ApiProperty() rubricVersion!: string;
  @ApiProperty({ type: () => InterviewClaimScoreDto, isArray: true }) claims!: InterviewClaimScoreDto[];
  @ApiProperty({ type: String, isArray: true }) adjacentServices!: string[];
  @ApiProperty({ type: String, isArray: true }) searchTerms!: string[];
  @ApiProperty({ type: () => InterviewQualityDto }) interviewQuality!: InterviewQualityDto;
}

export class InterviewFlagEvidenceDto {
  @ApiProperty() label!: string;
  @ApiProperty({ nullable: true, type: Number }) turn!: number | null;
  @ApiProperty({ nullable: true, type: String }) quote!: string | null;
}

export class InterviewReviewFlagDto {
  @ApiProperty() id!: string;
  @ApiProperty() interviewId!: string;
  @ApiProperty() memberId!: string;
  @ApiProperty() memberName!: string;
  @ApiProperty() claimId!: string;
  @ApiProperty() claimText!: string;
  @ApiProperty({ type: String, isArray: true }) serviceIds!: string[];
  @ApiProperty({ enum: REVIEW_FLAG_REASONS }) reason!: ReviewFlagReason;
  @ApiProperty({ type: () => InterviewFlagEvidenceDto, isArray: true }) evidence!: InterviewFlagEvidenceDto[];
  @ApiProperty({ enum: REVIEW_FLAG_STATUSES }) status!: ReviewFlagStatus;
  @ApiProperty({ nullable: true, type: String }) resolutionNote!: string | null;
  @ApiProperty({ nullable: true, type: String }) resolvedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

export class InterviewReviewFlagListResponse {
  @ApiProperty({ type: () => InterviewReviewFlagDto, isArray: true }) items!: InterviewReviewFlagDto[];
  @ApiProperty() total!: number;
}

// PATCH /v1/admin/interview-flags/:id
export class ResolveInterviewFlagRequest {
  @ApiProperty({ enum: ['dismissed', 'confirmed'] }) status!: 'dismissed' | 'confirmed';
  @ApiPropertyOptional() note?: string;
}

export class AdminInterviewListItem {
  @ApiProperty() id!: string;
  @ApiProperty() memberId!: string;
  @ApiProperty() memberName!: string;
  @ApiProperty({ enum: INTERVIEW_STATUSES }) status!: InterviewStatus;
  @ApiProperty() elapsedSeconds!: number;
  @ApiProperty({ nullable: true, type: String }) endedAt!: string | null;
  @ApiProperty() hasScoring!: boolean;
  @ApiProperty({ nullable: true, type: String }) verifiedAt!: string | null;
  @ApiProperty() createdAt!: string;
}

export class AdminInterviewListResponse {
  @ApiProperty({ type: () => AdminInterviewListItem, isArray: true }) items!: AdminInterviewListItem[];
  @ApiProperty() total!: number;
}

export class AdminInterviewConnectionDto {
  @ApiProperty() id!: string;
  @ApiProperty() startedAt!: string;
  @ApiProperty({ nullable: true, type: String }) endedAt!: string | null;
  @ApiProperty({ nullable: true, type: Number }) durationSeconds!: number | null;
  @ApiProperty({ type: () => InterviewTranscriptTurn, isArray: true }) transcript!: InterviewTranscriptTurn[];
  /** Short-lived signed URL, null when no audio was received. */
  @ApiProperty({ nullable: true, type: String }) audioUrl!: string | null;
}

export class AdminInterviewDetail extends AdminInterviewListItem {
  /** InterviewPlan JSON (see the backend's brain/types.ts); opaque to the admin UI beyond display. */
  @ApiProperty({ type: Object, nullable: true }) plan!: Record<string, unknown> | null;
  /** Live ladder state (claim, step, re-asks). */
  @ApiProperty({ type: Object }) state!: Record<string, unknown>;
  @ApiProperty({ nullable: true, type: () => InterviewDrafts }) drafts!: InterviewDrafts | null;
  @ApiProperty({ nullable: true, type: String }) summary!: string | null;
  @ApiProperty({ nullable: true, enum: SUMMARY_STATUSES }) summaryStatus!: InterviewSummaryStatus | null;
  /** ClaimLedger JSON (backend brain/types.ts). */
  @ApiProperty({ type: Object, nullable: true }) ledger!: Record<string, unknown> | null;
  @ApiProperty({ nullable: true, type: () => InterviewScoringResultDto }) scoring!: InterviewScoringResultDto | null;
  @ApiProperty({ type: () => InterviewReviewFlagDto, isArray: true }) flags!: InterviewReviewFlagDto[];
  @ApiProperty() audioOptIn!: boolean;
  /** Token counters per model role: { turn: { calls, input, output, cached }, … }. */
  @ApiProperty({ type: Object }) llmUsage!: Record<string, unknown>;
  @ApiProperty({ nullable: true, type: String }) failureReason!: string | null;
  @ApiProperty({ type: () => AdminInterviewConnectionDto, isArray: true }) connections!: AdminInterviewConnectionDto[];
}

export class AdminUpdateInterviewSummaryRequest {
  @ApiProperty() hidden!: boolean;
}
