import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { REVIEW_FLAG_STATUSES, type ReviewFlagStatus, type ResolveInterviewFlagRequest } from '@shared/interview';
import {
  FACET_KINDS,
  FACET_VALUE_STATUSES,
  type AdminSubtagDecisionItem,
  type AdminUpdateSubtagsRequest,
  type CreateFacetValueRequest,
  type FacetKind,
  type FacetValueStatus,
  type UpdateFacetValueRequest,
} from '@shared/subtags';

class PageQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
}

export class FlagListQueryDto extends PageQuery {
  @IsOptional() @IsIn(REVIEW_FLAG_STATUSES) status?: ReviewFlagStatus;
}

export class ResolveFlagDto implements ResolveInterviewFlagRequest {
  @IsIn(['dismissed', 'confirmed']) status!: 'dismissed' | 'confirmed';
  @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class AdminSubtagDecisionItemDto implements AdminSubtagDecisionItem {
  @IsUUID() serviceId!: string;
  @IsBoolean() accept!: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsUUID('all', { each: true }) addFacetValueIds?: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(40) @IsUUID('all', { each: true }) removeFacetValueIds?: string[];
}

export class AdminUpdateSubtagsDto implements AdminUpdateSubtagsRequest {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => AdminSubtagDecisionItemDto)
  services!: AdminSubtagDecisionItemDto[];
}

export class FacetValueQueryDto extends PageQuery {
  @IsOptional() @IsIn(FACET_KINDS) facet?: FacetKind;
  @IsOptional() @IsIn(FACET_VALUE_STATUSES) status?: FacetValueStatus;
}

export class CreateFacetValueDto implements CreateFacetValueRequest {
  @IsIn(FACET_KINDS) facet!: FacetKind;
  @IsString() @MinLength(1) @MaxLength(120) label!: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  aliases?: string[];
}

export class UpdateFacetValueDto implements UpdateFacetValueRequest {
  @IsOptional() @IsIn(FACET_VALUE_STATUSES) status?: FacetValueStatus;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) label?: string;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  aliases?: string[];
}
