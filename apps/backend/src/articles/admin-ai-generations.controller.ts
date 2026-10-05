import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import type { AdminAiGenerationDetailDto, AdminAiGenerationListItemDto } from '@shared/article';
import { AdminAiGenerationsService } from './admin-ai-generations.service';
import { AdminAiGenerationsQueryDto } from './dto/admin-ai-generations-query.dto';

// 🛡️ manageArticles — read-only log of every AI article-draft attempt (inputs + output), same
// permission as the article review queue it sits next to.
@Roles('admin')
@RequiresPermission('manageArticles')
@Controller('admin/ai-generations')
export class AdminAiGenerationsController {
  constructor(private readonly service: AdminAiGenerationsService) {}

  // Newest first, capped at 200; optional ?status=success|failed and ?authorId= filters.
  @Get()
  list(@Query() query: AdminAiGenerationsQueryDto): Promise<AdminAiGenerationListItemDto[]> {
    return this.service.list(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AdminAiGenerationDetailDto> {
    return this.service.findOne(id);
  }
}
