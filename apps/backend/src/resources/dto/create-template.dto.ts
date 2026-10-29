import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  TEMPLATE_CATEGORIES,
  type ResourceAudience,
  type TemplateCategory,
  type TemplateFileType,
} from '@shared/resource';

// filePath must be an object we put in the private template-files bucket (seed files under
// starter/, admin uploads under uploads/) — never an arbitrary path or URL.
const TEMPLATE_FILE_PATH = /^(starter|uploads)\/[a-z0-9-]+\.(docx|xlsx|pptx|pdf)$/;

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(/\S/)
  title!: string;
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MaxLength(5000)
  description?: string;
  @IsIn(TEMPLATE_CATEGORIES)
  category!: TemplateCategory;
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  highlights?: string[];
  @Matches(TEMPLATE_FILE_PATH)
  filePath!: string;
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Matches(/^[^/\\\r\n]+\.(docx|xlsx|pptx|pdf)$/)
  fileName!: string;
  @IsInt()
  @Min(1)
  @Max(15 * 1024 * 1024)
  fileSizeBytes!: number;
  @IsIn(['docx', 'xlsx', 'pptx', 'pdf'])
  fileType!: TemplateFileType;
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(2048)
  @Matches(/^(https:\/\/|templates\/)[^\s?#]+$/)
  previewImageUrl?: string | null;
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(3)
  @IsIn(['tax', 'legal', 'audit'], { each: true })
  audiences?: ResourceAudience[];
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isFeatured?: boolean;
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  sortOrder?: number;
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  isActive?: boolean;
}
