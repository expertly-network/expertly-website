// dto/update-my-subtags.dto.ts
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { MemberSubtagEditItem, UpdateMySubtagsRequest } from '@shared/subtags';

export class MemberSubtagEditItemDto implements MemberSubtagEditItem {
  @IsUUID()
  serviceId!: string;

  @IsArray()
  @ArrayMaxSize(40)
  @IsUUID('all', { each: true })
  removeFacetValueIds!: string[];

  @IsOptional()
  @IsString()
  @MinLength(20)
  @MaxLength(400)
  evidenceSummary?: string | null;
}

export class UpdateMySubtagsDto implements UpdateMySubtagsRequest {
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => MemberSubtagEditItemDto)
  services!: MemberSubtagEditItemDto[];
}
