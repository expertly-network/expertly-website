import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { AdminApplicationListItemDto, ApplicationStatus } from '@shared/membership-application';
import { ApplicationsService } from './applications.service';
import { ReviewApplicationDto } from './dto/review-application.dto';

// 🛡️ manageApplications — admin review queue.
@Roles('admin')
@RequiresPermission('manageApplications')
@Controller('admin')
export class AdminApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  // Defaults to the review queue (submitted + under_review) when status is omitted.
  @Get('applications')
  list(@Query('status') status?: ApplicationStatus): Promise<AdminApplicationListItemDto[]> {
    return this.service.listForReview(status);
  }

  @Patch('applications/:id')
  review(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewApplicationDto
  ) {
    return this.service.reviewApplication(id, admin, dto);
  }
}
