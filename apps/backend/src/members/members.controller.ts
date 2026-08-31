import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
// Real (not `import type`) import — Swagger's @ApiResponse needs the actual classes at runtime.
import { MemberDto, MemberListItemDto, MemberProfileEditDto, UploadResponse } from '@shared/member';
import { MembersService } from './members.service';
import { CreateMemberEditDto } from './dto/create-member-edit.dto';
import { CreateUploadDto } from './dto/create-upload.dto';

function toArray(value?: string | string[]): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

@Controller('members')
export class MembersController {
  constructor(private readonly service: MembersService) {}

  // 🌐 Public — the directory list, active members only.
  @Public()
  @Get()
  list(
    @Query('q') q?: string,
    @Query('practiceAreaId') practiceAreaId?: string | string[],
    @Query('country') country?: string | string[],
    @Query('rateMinCents') rateMinCents?: string,
    @Query('rateMaxCents') rateMaxCents?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ): Promise<MemberListItemDto[]> {
    return this.service.list({
      q,
      practiceAreaId: toArray(practiceAreaId),
      country: toArray(country),
      rateMinCents: rateMinCents ? Number(rateMinCents) : undefined,
      rateMaxCents: rateMaxCents ? Number(rateMaxCents) : undefined,
      sort,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  // 🔒 full detail requires sign-in (any role) — a deliberate product decision, see
  // docs/database-erd.md. No @Public() here is deliberate, same posture as articles' findOne.
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<MemberDto> {
    return this.service.findOne(id, user);
  }

  // member, owner-only (checked in service — :id must equal the caller's own id).
  @Roles('member')
  @Post(':id/uploads')
  requestUpload(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadDto
  ): Promise<UploadResponse> {
    return this.service.requestUpload(id, user, dto);
  }

  // member, owner-only. Never touches the live profile — only creates a pending edit request;
  // admin approval (see AdminMembersController) applies it.
  @Roles('member')
  @Patch(':id/edits')
  createEdit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMemberEditDto
  ): Promise<MemberProfileEditDto> {
    return this.service.createEdit(id, user, dto);
  }

  // 🔒 Owner — no @Roles() needed, same as GET /articles/me; the service's ownership check is
  // what actually scopes this.
  @Get(':id/edits')
  listMyEdits(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<MemberProfileEditDto[]> {
    return this.service.listMyEdits(id, user);
  }
}
