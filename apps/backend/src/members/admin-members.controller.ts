import { Body, Controller, Get, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { AdminMemberListItemDto } from '@shared/member';
import type { MemberEditSection } from '@shared/member';
import type { AdminMemberVerificationSummaryDto } from '@shared/member-verification';
import { AdminMemberVerificationDetailDto } from '@shared/member';
import { MembersService } from './members.service';
import { MemberVerificationService } from './member-verification.service';
import { MEMBER_EDIT_SECTION_ENUM } from './dto/save-section.dto';
import { AdminSetVerifiedDto } from './dto/verification.dto';
import { UpdateAdminMemberDto } from './dto/update-admin-member.dto';

// 🛡️ manageMembers on every route here.
@Roles('admin')
@RequiresPermission('manageMembers')
@Controller('admin')
export class AdminMembersController {
  constructor(
    private readonly membersService: MembersService,
    private readonly verificationService: MemberVerificationService
  ) {}

  @Get('members')
  listMembers(): Promise<AdminMemberListItemDto[]> {
    return this.membersService.adminList();
  }

  @Patch('members/:id')
  updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminMemberDto
  ): Promise<AdminMemberListItemDto> {
    return this.membersService.adminUpdateMember(id, dto);
  }

  // ── verification (2026-11-15): edits are live; the admin verifies afterwards ──────────────────
  @Get('member-verification')
  verificationSummary(): Promise<AdminMemberVerificationSummaryDto[]> {
    return this.verificationService.adminSummary();
  }

  @Get('members/:id/verification')
  getVerification(@Param('id', ParseUUIDPipe) id: string): Promise<AdminMemberVerificationDetailDto> {
    return this.membersService.adminGetVerification(id);
  }

  @Patch('members/:id/sections/:section/items/:itemId')
  @HttpCode(204)
  async setItemVerified(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('section', new ParseEnumPipe(MEMBER_EDIT_SECTION_ENUM)) section: MemberEditSection,
    @Param('itemId') itemId: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: AdminSetVerifiedDto
  ): Promise<void> {
    await this.verificationService.adminSetItemVerified(id, section, itemId, dto.verified);
  }

  @Patch('members/:id/contact-verification')
  @HttpCode(204)
  async setContactVerified(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: AdminSetVerifiedDto
  ): Promise<void> {
    await this.verificationService.adminSetContactVerified(id, dto.verified);
  }

  // 🛡️ The whole-profile "GrowXQ Verified" badge — the admin's final decision, separate from the entry ticks.
  @Patch('members/:id/profile-verification')
  @HttpCode(204)
  async setProfileVerified(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminSetVerifiedDto): Promise<void> {
    await this.verificationService.adminSetProfileVerified(id, dto.verified);
  }
}
