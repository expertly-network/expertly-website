import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { AdminApplicationListItemDto, ApplicationStatus } from '@shared/membership-application';
import { ApplicationsService } from './applications.service';
import { ReviewApplicationDto } from './dto/review-application.dto';

// 🛡️ manageApplications — @Roles('admin') for the base role (freshly re-checked by RolesGuard),
// @RequiresPermission('manageApplications') to further narrow to admins whose admin_role
// actually carries it (freshly re-checked by AdminPermissionGuard). GET is consumed by the
// admin review-queue UI at apps/frontend/app/(admin)/admin/applications; the PATCH below
// predates that UI (was backend-only) but is unchanged.
@Roles('admin')
@RequiresPermission('manageApplications')
@Controller('admin')
export class AdminApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  // `status` narrows to one bucket (e.g. ?status=approved to audit past decisions); omit for
  // the default review queue (submitted + under_review) — see ApplicationsService.listForReview.
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
