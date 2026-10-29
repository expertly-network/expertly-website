import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export const MEMBER_LIST_DEFAULT_PAGE_SIZE = 8;
export const MEMBER_LIST_MAX_PAGE_SIZE = 50;
const SORTS = ['featured', 'newest', 'tenure', 'rate_asc', 'rate_desc'] as const;

// A repeated query param (?serviceId=a&serviceId=b) arrives as an array, a single one as a string.
const toArray = ({ value }: { value: unknown }) => (value === undefined ? undefined : Array.isArray(value) ? value : [value]);

// GET /v1/members — the public directory. Every param is bounded: page size is capped (so one
// call can't dump the whole directory) and free text is length-limited.
export class ListMembersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('all', { each: true })
  serviceId?: string[];

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  country?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rateMinCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rateMaxCents?: number;

  @IsOptional()
  @IsIn(SORTS)
  sort?: (typeof SORTS)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MEMBER_LIST_MAX_PAGE_SIZE)
  pageSize?: number;
}
