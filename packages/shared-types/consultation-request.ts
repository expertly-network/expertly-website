import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type ConsultationStatus = 'pending' | 'completed' | 'declined';

// Matches supabase/migrations/0004_tables.sql's `consultation_requests` table, enriched with
// display fields resolved server-side from `profiles`/`member_profiles`/`services` — never
// trusted from client input. `subject`/`description`/`scheduledAt` are schema columns with no UI
// anywhere in this feature and remain deliberately unexposed — see
// docs/superpowers/specs/2026-10-01-consultations-backend-design.md §3. `serviceId`/
// `customServiceLabel`/`responseMessage` ARE exposed (added after that spec, per later product
// requirements — `responseMessage` is the member's required reason when marking a request
// completed/declined, set via `UpdateConsultationStatusRequest` below).
export class ConsultationRequestDto {
  @ApiProperty() id!: string;
  @ApiProperty() requesterId!: string;
  @ApiProperty() requesterName!: string;
  @ApiProperty() requesterContactEmail!: string;
  @ApiProperty() requesterPhone!: string;
  @ApiProperty() memberId!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ enum: ['pending', 'completed', 'declined'] }) status!: ConsultationStatus;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  // Exactly one of these two is set (serviceId XOR customServiceLabel), enforced server-side.
  @ApiPropertyOptional({ nullable: true, type: String }) serviceId?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) customServiceLabel?: string | null;
  // Populated on GET /consultations/mine, /received, and /admin/consultations — the chosen
  // service's display name, resolved server-side from `services.name`. Null when
  // customServiceLabel was used instead.
  @ApiPropertyOptional({ nullable: true, type: String }) serviceName?: string | null;
  // Populated on GET /consultations/mine and GET /admin/consultations — who the request went to.
  // Undefined on GET /consultations/received (the viewer already knows — it's themselves) and on
  // the raw POST /consultations response.
  @ApiPropertyOptional({ nullable: true, type: String }) memberName?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) memberFirmName?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) memberHeadline?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) memberAvatarUrl?: string | null;
  // city/country from member_profiles — same source the member directory/profile pages show.
  @ApiPropertyOptional({ nullable: true, type: String }) memberCity?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) memberCountry?: string | null;
  // The member's profile URL slug (/members/[slug]) — added for the frontend's "View Profile"
  // link on GET /consultations/mine; not part of the original backend contract.
  @ApiPropertyOptional({ nullable: true, type: String }) memberSlug?: string | null;
  // Populated on GET /consultations/received and GET /admin/consultations — whether the requester
  // is themselves a verified member (peer-to-peer request), computed server-side from
  // profiles.role, never from client input.
  @ApiPropertyOptional() requesterIsVerifiedMember?: boolean;
  @ApiPropertyOptional({ nullable: true, type: String }) requesterFirmName?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) requesterAvatarUrl?: string | null;
  // Set only when requesterIsVerifiedMember — a plain client requester has no member_profiles row.
  @ApiPropertyOptional({ nullable: true, type: String }) requesterCity?: string | null;
  @ApiPropertyOptional({ nullable: true, type: String }) requesterCountry?: string | null;
  // The member's reason when marking the request completed/declined. Null while status is
  // 'pending' — required going forward on every status transition (see
  // UpdateConsultationStatusRequest), so an older row could in principle still be null even if
  // no longer pending, but that's not reachable through this app's own UI.
  @ApiPropertyOptional({ nullable: true, type: String }) responseMessage?: string | null;
  // The requester's 1-5 rating of the conversation, settable only once status is no longer
  // 'pending' (see RateConsultationRequestRequest below). Null until rated.
  @ApiPropertyOptional({ nullable: true, type: Number }) rating?: number | null;
}

export class CreateConsultationRequestRequest {
  @ApiProperty() memberId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() email!: string;
  @ApiProperty() phone!: string;
  // At least 100 characters, enforced server-side — a UI-facing quality bar, not a formatting
  // nicety, so the member receiving the request has enough context to decide.
  @ApiProperty() message!: string;
  // Exactly one of these two is required — pick one of the target member's own offered services
  // (validated server-side against member_services), or describe it in customServiceLabel.
  @ApiPropertyOptional() serviceId?: string;
  @ApiPropertyOptional() customServiceLabel?: string;
}

export class UpdateConsultationStatusRequest {
  @ApiProperty({ enum: ['completed', 'declined'] }) status!: 'completed' | 'declined';
  // Required — at least 10 characters, enforced server-side. The requester sees this, so a bare
  // status flip with no explanation isn't enough.
  @ApiProperty() responseMessage!: string;
}

// A free-form back-and-forth thread on a consultation request — either participant (requester or
// member) can post, regardless of the request's current status. Matches
// supabase/migrations/0004_tables.sql's `consultation_messages` table.
export class ConsultationMessageDto {
  @ApiProperty() id!: string;
  @ApiProperty() requestId!: string;
  @ApiProperty() senderId!: string;
  @ApiProperty() body!: string;
  @ApiProperty() createdAt!: string;
  // Resolved server-side from `profiles` — never trusted from client input.
  @ApiProperty() senderName!: string;
  @ApiPropertyOptional({ nullable: true, type: String }) senderAvatarUrl?: string | null;
}

export class CreateConsultationMessageRequest {
  // 1–2000 chars, enforced server-side.
  @ApiProperty() body!: string;
}

// The requester rates the conversation 1-5 once the member has decided (status is no longer
// 'pending') — the thread closes to new messages at that point (see ConsultationMessageDto's
// endpoints) and this replaces it on the requester's side.
export class RateConsultationRequestRequest {
  @ApiProperty() rating!: number;
}
