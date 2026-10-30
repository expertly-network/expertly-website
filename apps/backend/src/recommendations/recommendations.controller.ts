import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { MemberRecommendationDto } from '@shared/member';
import { RecommendationsService } from './recommendations.service';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { UpdateRecommendationDto } from './dto/update-recommendation.dto';
import { RATE_LIMITS, RateLimit } from '../common/rate-limit/rate-limit.decorator';

// `:id` is the RECOMMENDED member's profile UUID (MemberDto.id), same as the other member write routes.
@Controller('members/:id/recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  // 🔒 signed in — visible recommendations (recipient/admin also get hidden ones).
  @Get()
  list(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MemberRecommendationDto[]> {
    return this.recommendationsService.list(id, user);
  }

  // 🔑 member (active, not the recipient) — publishes immediately.
  @Roles('member')
  @RateLimit('write', ...RATE_LIMITS.write)
  @Post()
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRecommendationDto
  ): Promise<MemberRecommendationDto> {
    return this.recommendationsService.create(id, user, dto);
  }

  // 🔑 member — only the recommended member (`:id`) can hide/unhide.
  @Roles('member')
  @Patch(':recommendationId')
  setHidden(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recommendationId', ParseUUIDPipe) recommendationId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateRecommendationDto
  ): Promise<MemberRecommendationDto> {
    return this.recommendationsService.setHidden(id, recommendationId, user, dto);
  }
}
