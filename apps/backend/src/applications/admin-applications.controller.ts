import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { AdminApplicationListItemDto, ApplicationDto, ApplicationStatus } from '@shared/membership-application';
import { ApplicationsService } from './applications.service';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { OptionalOneOfPipe } from '../common/one-of.pipe';

const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'rejected',
];

// 🛡️ manageApplications — admin review queue.
@Roles('admin')
@RequiresPermission('manageApplications')
@Controller('admin')
export class AdminApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // Returns every status when status is omitted — the admin table filters client-side.
  @Get('applications')
  list(
    @Query('status', new OptionalOneOfPipe('status', APPLICATION_STATUSES)) status?: ApplicationStatus
  ): Promise<AdminApplicationListItemDto[]> {
    return this.applicationsService.listForReview(status);
  }

  // Full detail for the review page — same ApplicationDto shape as the applicant's own
  // GET /v1/applications/me.
  @Get('applications/:id')
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApplicationDto> {
    return this.applicationsService.getForReview(id);
  }

  @Patch('applications/:id')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewApplicationDto
  ) {
    return this.applicationsService.reviewApplication(id, admin, dto);
  }
}
