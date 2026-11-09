import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
export type InterviewEligibility = 'available' | 'in_progress' | 'can_reconnect' | 'processing' | 'completed' | 'failed';

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
  @ApiPropertyOptional({ type: () => InterviewDraftEngagement, isArray: true }) engagements?: InterviewDraftEngagement[];
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
}

// GET /v1/interviews/me. Never includes plan, state, assessment or audio.
export class MyInterviewResponse {
  @ApiProperty({ enum: INTERVIEW_ELIGIBILITIES }) eligibility!: InterviewEligibility;
  @ApiProperty({ nullable: true, type: () => MyInterviewDto }) interview!: MyInterviewDto | null;
  @ApiProperty() consentVersion!: string;
  /** Hard cap for the whole interview, in seconds (1800). */
  @ApiProperty() maxSeconds!: number;
}

export class StartInterviewRequest {
  @ApiProperty() consentVersion!: string;
}

export class StartInterviewResponse {
  @ApiProperty() interviewId!: string;
  @ApiProperty() connectionId!: string;
  /** ElevenLabs WebRTC conversation token, minted server-side. */
  @ApiProperty() conversationToken!: string;
  /** Pass to the SDK as customLlmExtraBody.sessionToken AND dynamicVariables.session_token. */
  @ApiProperty() sessionToken!: string;
  /** Remaining wall-clock budget for this connection, ≤ 1800. */
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

export class InterviewClaimNote {
  @ApiProperty() claim!: string;
  @ApiProperty() quote!: string;
}

export class InterviewContradiction {
  @ApiProperty() claim!: string;
  @ApiProperty() conflictsWith!: string;
  @ApiProperty() quote!: string;
}

/** Admin-only. */
export class InterviewAssessment {
  @ApiProperty() depth!: number;
  @ApiProperty() consistency!: number;
  /** Share of priority-1 facts filled, 0–1. */
  @ApiProperty() coverage!: number;
  @ApiProperty({ type: String, isArray: true }) strengths!: string[];
  @ApiProperty({ type: () => InterviewClaimNote, isArray: true }) vagueClaims!: InterviewClaimNote[];
  @ApiProperty({ type: () => InterviewContradiction, isArray: true }) contradictions!: InterviewContradiction[];
  @ApiProperty() notes!: string;
}

export class AdminInterviewListItem {
  @ApiProperty() id!: string;
  @ApiProperty() memberId!: string;
  @ApiProperty() memberName!: string;
  @ApiProperty({ enum: INTERVIEW_STATUSES }) status!: InterviewStatus;
  @ApiProperty() elapsedSeconds!: number;
  @ApiProperty({ nullable: true, type: String }) endedAt!: string | null;
  @ApiProperty() hasAssessment!: boolean;
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
  /** Live state incl. the facts board. */
  @ApiProperty({ type: Object }) state!: Record<string, unknown>;
  @ApiProperty({ nullable: true, type: () => InterviewDrafts }) drafts!: InterviewDrafts | null;
  @ApiProperty({ nullable: true, type: String }) summary!: string | null;
  @ApiProperty({ nullable: true, enum: SUMMARY_STATUSES }) summaryStatus!: InterviewSummaryStatus | null;
  @ApiProperty({ nullable: true, type: () => InterviewAssessment }) assessment!: InterviewAssessment | null;
  @ApiProperty({ nullable: true, type: String }) failureReason!: string | null;
  @ApiProperty({ type: () => AdminInterviewConnectionDto, isArray: true }) connections!: AdminInterviewConnectionDto[];
}

export class AdminUpdateInterviewSummaryRequest {
  @ApiProperty() hidden!: boolean;
}
