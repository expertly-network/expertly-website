import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
export class ResourceQueryDto {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsString() @MaxLength(100) category?: string;
  @IsOptional() @IsIn(['tax', 'legal', 'audit']) audience?: string;
  @IsOptional() @IsIn(['beginner', 'intermediate', 'advanced']) level?: string;
  @IsOptional() @IsIn(['true', 'false']) featured?: string;
  @IsOptional() @IsIn(['learning_playlist', 'perk_stack', 'template_kit']) kind?: string;
}
