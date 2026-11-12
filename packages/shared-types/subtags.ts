import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const FACET_KINDS = [
  'jurisdiction',
  'instrument',
  'work_type',
  'forum',
  'client_type',
  'industry',
  'scale',
  'volume',
] as const;
export type FacetKind = (typeof FACET_KINDS)[number];

export const SUBTAG_STATUSES = ['proposed', 'member_approved', 'active', 'rejected'] as const;
export type SubtagStatus = (typeof SUBTAG_STATUSES)[number];

export const FACET_VALUE_STATUSES = ['canonical', 'candidate', 'rejected'] as const;
export type FacetValueStatus = (typeof FACET_VALUE_STATUSES)[number];

export class SubtagDto {
  @ApiProperty() facetValueId!: string;
  @ApiProperty({ enum: FACET_KINDS }) facet!: FacetKind;
  @ApiProperty() label!: string;
}

/** One service's interview proposal, as the member sees it (no scores). */
export class InterviewProposedServiceDto {
  @ApiProperty() serviceId!: string;
  @ApiProperty() serviceName!: string;
  @ApiProperty() categoryName!: string;
  @ApiProperty() evidenceSummary!: string;
  @ApiProperty({ type: () => SubtagDto, isArray: true }) subtags!: SubtagDto[];
  @ApiProperty({ enum: SUBTAG_STATUSES }) status!: SubtagStatus;
}

/** Active sub-tags on a public profile. */
export class PublicServiceSubtagsDto {
  @ApiProperty() serviceId!: string;
  @ApiProperty({ type: () => SubtagDto, isArray: true }) subtags!: SubtagDto[];
}

export class MemberSubtagEditItem {
  @ApiProperty() serviceId!: string;
  @ApiProperty({ type: String, isArray: true }) removeFacetValueIds!: string[];
  /** Optional rewrite of the evidence summary (≤ 400 chars). */
  @ApiPropertyOptional({ nullable: true, type: String }) evidenceSummary?: string | null;
}

// PATCH /v1/interviews/me/subtags
export class UpdateMySubtagsRequest {
  @ApiProperty({ type: () => MemberSubtagEditItem, isArray: true }) services!: MemberSubtagEditItem[];
}

export class AdminSubtagDecisionItem {
  @ApiProperty() serviceId!: string;
  @ApiProperty() accept!: boolean;
  @ApiProperty({ type: String, isArray: true, required: false }) addFacetValueIds?: string[];
  @ApiProperty({ type: String, isArray: true, required: false }) removeFacetValueIds?: string[];
}

// PATCH /v1/admin/members/:memberId/subtags
export class AdminUpdateSubtagsRequest {
  @ApiProperty({ type: () => AdminSubtagDecisionItem, isArray: true }) services!: AdminSubtagDecisionItem[];
}

export class AdminMemberServiceEvidenceDto extends InterviewProposedServiceDto {
  /** Admin-only ranking inputs; never shown to members. */
  @ApiProperty() role!: number;
  @ApiProperty() evidence!: string;
  @ApiProperty({ nullable: true, type: Number }) recencyYear!: number | null;
}

export class FacetValueDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: FACET_KINDS }) facet!: FacetKind;
  @ApiProperty() label!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ enum: FACET_VALUE_STATUSES }) status!: FacetValueStatus;
  @ApiProperty({ type: String, isArray: true }) aliases!: string[];
  @ApiProperty() sourceCount!: number;
}

export class FacetValueListResponse {
  @ApiProperty({ type: () => FacetValueDto, isArray: true }) items!: FacetValueDto[];
  @ApiProperty() total!: number;
}

// POST /v1/admin/facet-values — create a value (e.g. from a member's search terms)
export class CreateFacetValueRequest {
  @ApiProperty({ enum: FACET_KINDS }) facet!: FacetKind;
  @ApiProperty() label!: string;
  @ApiPropertyOptional({ type: String, isArray: true }) aliases?: string[];
}

// PATCH /v1/admin/facet-values/:id
export class UpdateFacetValueRequest {
  @ApiPropertyOptional({ enum: FACET_VALUE_STATUSES }) status?: FacetValueStatus;
  @ApiPropertyOptional() label?: string;
  @ApiPropertyOptional({ type: String, isArray: true }) aliases?: string[];
}

export class AnchorEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() serviceId!: string;
  @ApiProperty({ type: String, isArray: true }) deliverables!: string[];
  @ApiProperty({ type: String, isArray: true }) instruments!: string[];
  @ApiProperty({ type: String, isArray: true }) tools!: string[];
  @ApiProperty() practitionerDetail!: string;
  @ApiProperty() bluffAnswer!: string;
}
