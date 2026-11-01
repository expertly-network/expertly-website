import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { MemberDto, MemberListItemDto, MemberProfileEditDto, MyMemberProfileDto, UploadResponse } from '@shared/member';
import { MembersService } from './members.service';
import { CreateMemberEditDto } from './dto/create-member-edit.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';
import { RATE_LIMITS, RateLimit } from '../common/rate-limit/rate-limit.decorator';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  // 🌐 Public — the member directory, one page at a time (pageSize ≤ 50).
  @Public()
  @Get()
  async list(
    @Query() query: ListMembersQueryDto,
    @Res({ passthrough: true }) reply: FastifyReply
  ): Promise<MemberListItemDto[]> {
    const { items, total } = await this.membersService.list(query);
    // Total matches across all pages (as GET /v1/events does); the body stays a plain array.
    reply.header('X-Total-Count', String(total));
    return items;
  }

  // 👤 Member — the caller's own profile id + slug. Two segments, so it never collides with a
  // single-segment slug read below.
  @Roles('member')
  @Get('me/profile')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<MyMemberProfileDto> {
    return this.membersService.findMine(user);
  }

  // Profile read is by slug (e.g. /v1/members/priya-menon), not UUID — the slug is what shows in
  // the browser's address bar. Owner/admin write routes below stay keyed on the UUID.
  @Get(':slug')
  findOne(@Param('slug') slug: string, @CurrentUser() user: AuthenticatedUser): Promise<MemberDto> {
    return this.membersService.findOneBySlug(slug, user);
  }

  @Roles('member')
  @RateLimit('upload', ...RATE_LIMITS.upload)
  @Post(':id/uploads')
  requestUpload(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadDto
  ): Promise<UploadResponse> {
    return this.membersService.requestUpload(id, user, dto);
  }

  @Roles('member')
  @RateLimit('write', ...RATE_LIMITS.write)
  @Post(':id/edits')
  createEdit(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMemberEditDto
  ): Promise<MemberProfileEditDto> {
    return this.membersService.createEdit(id, user, dto);
  }

  // 🔑 member, owner-only — the member's directly-editable fields (availability switch + note,
  // profile photo), any combination in one request. Applies immediately, no moderation queue.
  @Roles('member')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMemberDto
  ): Promise<MemberDto> {
    return this.membersService.updateOwnProfile(id, user, dto);
  }

  @Get(':id/edits')
  listMyEdits(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<MemberProfileEditDto[]> {
    return this.membersService.listMyEdits(id, user);
  }
}
