import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { RecommendationRequestDto } from '@shared/recommendation-request';
import { RecommendationRequestsService } from './recommendation-requests.service';
import {
  CreateRecommendationRequestDto,
  ListRecommendationRequestsQueryDto,
  UpdateRecommendationRequestDto,
} from './dto/recommendation-request.dto';
import { RATE_LIMITS, RateLimit } from '../common/rate-limit/rate-limit.decorator';

@Controller()
export class RecommendationRequestsController {
  constructor(private readonly service: RecommendationRequestsService) {}

  // 🔑 member — ask another active member (`:id`) for a recommendation. Sends them an email.
  @Roles('member')
  @RateLimit('write', ...RATE_LIMITS.write)
  @Post('members/:id/recommendation-requests')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecommendationRequestDto
  ): Promise<RecommendationRequestDto> {
    return this.service.create(id, user, dto);
  }

  // 🔑 member — my requests: `received` (default, pending only) or `sent`.
  @Roles('member')
  @Get('members/me/recommendation-requests')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListRecommendationRequestsQueryDto
  ): Promise<RecommendationRequestDto[]> {
    return this.service.list(user, query.direction ?? 'received');
  }

  // 🔑 member — the recipient ignores (silent decline) or the requester cancels.
  @Roles('member')
  @RateLimit('write', ...RATE_LIMITS.write)
  @Patch('recommendation-requests/:requestId')
  update(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRecommendationRequestDto
  ): Promise<RecommendationRequestDto> {
    return this.service.update(requestId, user, dto);
  }
}
