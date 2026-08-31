import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
// Real (not `import type`) import — Swagger's @ApiResponse needs the actual classes at runtime.
import { AdminMemberListItemDto, MemberProfileEditDto, RenewalPolicyDto } from '@shared/member';
import { MembersService } from './members.service';
import { UpdateAdminMemberDto } from './dto/update-admin-member.dto';
import { ReviewMemberEditDto } from './dto/review-member-edit.dto';
import { UpdateRenewalPolicyDto } from './dto/update-renewal-policy.dto';

// 🛡️ manageMembers on every route here — @Roles('admin') for the base role (freshly re-checked
// by RolesGuard), @RequiresPermission('manageMembers') to further narrow to admins whose
// admin_role actually carries this permission (freshly re-checked by AdminPermissionGuard).
@Roles('admin')
@RequiresPermission('manageMembers')
@Controller('admin')
export class AdminMembersController {
  constructor(private readonly service: MembersService) {}

  @Get('members')
  listMembers(): Promise<AdminMemberListItemDto[]> {
    return this.service.adminList();
  }

  @Patch('members/:id')
  updateMember(@Param('id') id: string, @Body() dto: UpdateAdminMemberDto): Promise<AdminMemberListItemDto> {
    return this.service.adminUpdateMember(id, dto);
  }

  @Get('member-edits')
  listEdits(@Query('status') status?: string): Promise<MemberProfileEditDto[]> {
    return this.service.adminListEdits(status);
  }

  @Patch('member-edits/:id')
  reviewEdit(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewMemberEditDto
  ): Promise<MemberProfileEditDto> {
    return this.service.adminReviewEdit(id, admin, dto);
  }

  @Get('renewal-policy')
  getRenewalPolicy(): Promise<RenewalPolicyDto> {
    return this.service.getRenewalPolicy();
  }

  @Patch('renewal-policy')
  updateRenewalPolicy(@Body() dto: UpdateRenewalPolicyDto): Promise<RenewalPolicyDto> {
    return this.service.updateRenewalPolicy(dto);
  }
}
