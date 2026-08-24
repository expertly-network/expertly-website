import { Body, Controller, Param, Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ApplicationsService } from './applications.service';
import { ReviewApplicationDto } from './dto/review-application.dto';

// 🛡️ manageApplications — @Roles('admin') for the base role (freshly re-checked by RolesGuard),
// @RequiresPermission('manageApplications') to further narrow to admins whose admin_role
// actually carries it (freshly re-checked by AdminPermissionGuard). No UI consumes this route —
// backend-only per docs/superpowers/specs/2026-08-23-member-application-form-design.md §7
// (no admin-review page exists anywhere in the design prototype to build against).
@Roles('admin')
@RequiresPermission('manageApplications')
@Controller('admin')
export class AdminApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  @Patch('applications/:id')
  review(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewApplicationDto
  ) {
    return this.service.reviewApplication(id, admin, dto);
  }
}
