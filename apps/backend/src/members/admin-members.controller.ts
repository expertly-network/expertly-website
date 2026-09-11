import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AdminMemberListItemDto, MemberProfileEditDto } from '@shared/member';
import { MembersService } from './members.service';
import { UpdateAdminMemberDto } from './dto/update-admin-member.dto';
import { ReviewMemberEditDto } from './dto/review-member-edit.dto';

// 🛡️ manageMembers on every route here.
@Roles('admin')
@RequiresPermission('manageMembers')
@Controller('admin')
export class AdminMembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get('members')
  listMembers(): Promise<AdminMemberListItemDto[]> {
    return this.membersService.adminList();
  }

  @Patch('members/:id')
  updateMember(@Param('id') id: string, @Body() dto: UpdateAdminMemberDto): Promise<AdminMemberListItemDto> {
    return this.membersService.adminUpdateMember(id, dto);
  }

  @Get('member-edits')
  listEdits(@Query('status') status?: string): Promise<MemberProfileEditDto[]> {
    return this.membersService.adminListEdits(status);
  }

  @Patch('member-edits/:id')
  reviewEdit(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: ReviewMemberEditDto
  ): Promise<MemberProfileEditDto> {
    return this.membersService.adminReviewEdit(id, admin, dto);
  }
}
