import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Matches apps/backend/src/search/ and docs/rest-api.md "AI search". No database table of its own
// is exposed — results are display fields hydrated from members / articles / events.
// camelCase like every other DTO; the old Edge Function snake_case names are mapped in
// docs/rest-api.md ("old -> new").

export type SearchScope = 'all' | 'members' | 'articles' | 'events';
export type SearchDocType = 'member' | 'article' | 'event';
/** A stage that fell back to a cheaper behaviour; results are still returned. */
export type SearchDegradedTag = 'planner' | 'embedding' | 'judge';

export class SearchRateDto {
  @ApiProperty({ nullable: true, type: Number }) minCents!: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxCents!: number | null;
  @ApiProperty() currency!: string;
}

/** How strong a match is, from the AI judge's 0-10 score. Present when a topic was searched.
 * `tier` 'best' = strong or good; 'related' = "you might also need". Not a probability. */
export class SearchMatchDto {
  @ApiProperty({ description: 'AI judge score, 0-10' }) score!: number;
  @ApiProperty({ enum: ['strong', 'good', 'possible'] }) label!: 'strong' | 'good' | 'possible';
  @ApiProperty({ enum: ['best', 'related'] }) tier!: 'best' | 'related';
}

export class MemberSearchResult {
  @ApiProperty({ enum: ['member'] }) type!: 'member';
  /** `member_profiles.profile_id`. */
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ nullable: true, type: String }) headline!: string | null;
  @ApiProperty({ nullable: true, type: String }) firm!: string | null;
  @ApiProperty() location!: string;
  @ApiProperty({ type: [String] }) services!: string[];
  @ApiProperty() available!: boolean;
  @ApiProperty({ nullable: true, type: SearchRateDto }) rate!: SearchRateDto | null;
  /** AI relevance 0-10; present when a topic was searched. */
  @ApiPropertyOptional() relevance?: number;
  @ApiPropertyOptional({ type: SearchMatchDto }) match?: SearchMatchDto;
}

export class ArticleSearchResult {
  @ApiProperty({ enum: ['article'] }) type!: 'article';
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() excerpt!: string;
  @ApiProperty({ type: [String] }) countries!: string[];
  @ApiProperty() publishedAt!: string;
  @ApiProperty() readTimeMinutes!: number;
  @ApiPropertyOptional() relevance?: number;
  @ApiPropertyOptional({ type: SearchMatchDto }) match?: SearchMatchDto;
}

export class EventSearchResult {
  @ApiProperty({ enum: ['event'] }) type!: 'event';
  @ApiProperty() id!: string;
  @ApiProperty() title!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ nullable: true, type: String }) summary!: string | null;
  @ApiProperty() startsAt!: string;
  @ApiProperty({ nullable: true, type: String }) endsAt!: string | null;
  @ApiProperty() location!: string;
  @ApiProperty({ nullable: true, type: String }) format!: string | null;
  @ApiProperty() isFree!: boolean;
  @ApiProperty({ nullable: true, type: String }) registrationUrl!: string | null;
  @ApiPropertyOptional() relevance?: number;
  @ApiPropertyOptional({ type: SearchMatchDto }) match?: SearchMatchDto;
}

export type SearchResult = MemberSearchResult | ArticleSearchResult | EventSearchResult;

/** The filters the database was actually queried with (after normalisation and relaxing). */
export class SearchAppliedDto {
  @ApiProperty({ enum: ['member', 'article', 'event'], isArray: true }) types!: SearchDocType[];
  @ApiProperty({ nullable: true, type: String }) topic!: string | null;
  @ApiProperty({ type: [String] }) countries!: string[];
  @ApiProperty({ nullable: true, type: String }) city!: string | null;
  @ApiProperty({ nullable: true, type: [String] }) serviceIds!: string[] | null;
  @ApiProperty({ nullable: true, type: String }) dateFrom!: string | null;
  @ApiProperty({ nullable: true, type: String }) dateTo!: string | null;
  @ApiProperty({ nullable: true, type: Number }) maxHourlyRateUsd!: number | null;
  /** Soft filters dropped because nothing matched, in the order they were dropped. */
  @ApiProperty({ type: [String] }) relaxed!: string[];
}

export class SearchResponse {
  /** Id of this question's `search_query_log` row; send it back with `action: 'feedback'`. */
  @ApiProperty({ nullable: true, type: String }) logId!: string | null;
  @ApiProperty() answer!: string;
  @ApiProperty({ isArray: true, type: Object, description: 'Member | article | event results' })
  results!: SearchResult[];
  @ApiProperty({ type: SearchAppliedDto }) applied!: SearchAppliedDto;
  @ApiProperty({ enum: ['planner', 'embedding', 'judge'], isArray: true }) degraded!: SearchDegradedTag[];
  @ApiProperty() ms!: number;
}

export class SearchFeedbackResponse {
  @ApiProperty() ok!: boolean;
}

/** 429 body. */
export class SearchRateLimitError {
  @ApiProperty() statusCode!: number;
  @ApiProperty() error!: string;
  @ApiProperty() message!: string;
  @ApiProperty() retryAfterSeconds!: number;
}
