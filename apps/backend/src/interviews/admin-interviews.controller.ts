// admin-interviews.controller.ts
import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AdminInterviewDetail, AdminInterviewListResponse } from '@shared/interview';
import { RATE_LIMITS, RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { InterviewReviewService } from './interview-review.service';
import { InterviewsService } from './interviews.service';
import { AdminListQueryDto } from './dto/admin-list-query.dto';
import { AdminUpdateSummaryDto } from './dto/admin-update-summary.dto';

// 🛡️ manageMembers on every route, same posture as AdminMembersController.
@Roles('admin')
@RequiresPermission('manageMembers')
@Controller('admin/interviews')
export class AdminInterviewsController {
  constructor(
    private readonly service: InterviewsService,
    private readonly review: InterviewReviewService
  ) {}

  @Get()
  list(@Query() q: AdminListQueryDto): Promise<AdminInterviewListResponse> {
    return this.service.adminList(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AdminInterviewDetail> {
    return this.service.adminGet(id);
  }

  @Post(':id/redo')
  @HttpCode(204)
  redo(@CurrentUser() admin: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.service.adminRedo(admin, id);
  }

  @Patch(':id/summary')
  setSummary(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateSummaryDto
  ): Promise<AdminInterviewDetail> {
    return this.service.adminSetSummaryHidden(id, dto.hidden);
  }

  // Runs the scorer (an LLM call) again on the stored transcript.
  @RateLimit('ai', ...RATE_LIMITS.ai)
  @Post(':id/rescore')
  rescore(@Param('id', ParseUUIDPipe) id: string): Promise<AdminInterviewDetail> {
    return this.review.rescore(id);
  }
}
