import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import type { MemberEditItemDecision } from '@shared/member';

const ITEM_DECISIONS: MemberEditItemDecision[] = ['approved_verified', 'approved_hygiene', 'rejected'];

export class ReviewMemberEditItemDto {
  @IsInt()
  @Min(0)
  index!: number;

  @IsIn(ITEM_DECISIONS)
  decision!: MemberEditItemDecision;

  // Required for approved_hygiene and rejected — checked in MembersService (depends on decision).
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReviewMemberEditDto {
  // Whole-edit decision. Optional when `items` is given (derived from the item decisions).
  @IsOptional()
  @IsIn(['verified', 'rejected'])
  status?: 'verified' | 'rejected';

  @IsOptional()
  @IsString()
  reviewNote?: string;

  // Per-item decisions for array sections; must cover every payload index exactly once
  // (checked in MembersService, which knows the payload length).
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ReviewMemberEditItemDto)
  items?: ReviewMemberEditItemDto[];
}
