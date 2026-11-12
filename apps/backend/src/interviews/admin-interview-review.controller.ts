// admin-interview-review.controller.ts
import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { InterviewReviewFlagDto, InterviewReviewFlagListResponse } from '@shared/interview';
import { AdminMemberServiceEvidenceDto, AnchorEntryDto, FacetValueDto, FacetValueListResponse } from '@shared/subtags';
import { InterviewReviewService } from './interview-review.service';
import {
  AdminUpdateSubtagsDto,
  CreateFacetValueDto,
  FacetValueQueryDto,
  FlagListQueryDto,
  ResolveFlagDto,
  UpdateFacetValueDto,
} from './dto/admin-review.dto';

// 🛡️ manageMembers on every route, same posture as AdminInterviewsController.
@Roles('admin')
@RequiresPermission('manageMembers')
@Controller('admin')
export class AdminInterviewReviewController {
  constructor(private readonly review: InterviewReviewService) {}

  @Get('interview-flags')
  listFlags(@Query() q: FlagListQueryDto): Promise<InterviewReviewFlagListResponse> {
    return this.review.listFlags(q);
  }

  @Patch('interview-flags/:id')
  resolveFlag(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveFlagDto
  ): Promise<InterviewReviewFlagDto> {
    return this.review.resolveFlag(admin, id, dto);
  }

  @Get('members/:memberId/subtags')
  listSubtags(@Param('memberId', ParseUUIDPipe) memberId: string): Promise<AdminMemberServiceEvidenceDto[]> {
    return this.review.listMemberSubtags(memberId);
  }

  @Patch('members/:memberId/subtags')
  decideSubtags(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: AdminUpdateSubtagsDto
  ): Promise<AdminMemberServiceEvidenceDto[]> {
    return this.review.decideSubtags(admin, memberId, dto);
  }

  @Get('facet-values')
  listFacetValues(@Query() q: FacetValueQueryDto): Promise<FacetValueListResponse> {
    return this.review.listFacetValues(q);
  }

  @Post('facet-values')
  createFacetValue(@Body() dto: CreateFacetValueDto): Promise<FacetValueDto> {
    return this.review.createFacetValue(dto);
  }

  @Patch('facet-values/:id')
  updateFacetValue(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFacetValueDto): Promise<FacetValueDto> {
    return this.review.updateFacetValue(id, dto);
  }

  @Get('services/:id/anchor-entries')
  anchorEntries(@Param('id', ParseUUIDPipe) id: string): Promise<AnchorEntryDto[]> {
    return this.review.listAnchorEntries(id);
  }
}
