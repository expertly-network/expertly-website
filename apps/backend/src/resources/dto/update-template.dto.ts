import { PartialType } from '@nestjs/swagger';
import { CreateTemplateDto } from './create-template.dto';

// Every field optional, same validation rules as create.
export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}
