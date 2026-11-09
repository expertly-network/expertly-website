// interviews.controller.ts
import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { RATE_LIMITS, RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { MyInterviewDto, MyInterviewResponse, StartInterviewResponse } from '@shared/interview';
import { InterviewsService } from './interviews.service';
import { StartInterviewDto } from './dto/start-interview.dto';
import { UpdateSummaryDto } from './dto/update-summary.dto';

// 🔑 Member — the service additionally requires member_profiles.status = active.
@Roles('member')
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly service: InterviewsService) {}

  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser): Promise<MyInterviewResponse> {
    return this.service.getMine(user);
  }

  // Runs the planner (an LLM call) on first start, so it shares the AI allowance.
  @RateLimit('ai', ...RATE_LIMITS.ai)
  @Post('me/start')
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartInterviewDto): Promise<StartInterviewResponse> {
    return this.service.start(user, dto);
  }

  @Post('me/end')
  @HttpCode(204)
  end(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.service.end(user);
  }

  @Patch('me/summary')
  updateSummary(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSummaryDto): Promise<MyInterviewDto> {
    return this.service.updateSummary(user, dto);
  }
}
