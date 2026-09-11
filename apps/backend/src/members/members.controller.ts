import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
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
  constructor(private readonly membersService: MembersService) {}

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
    return this.membersService.list({
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

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<MemberDto> {
    return this.membersService.findOne(id, user);
  }

  @Roles('member')
  @Post(':id/uploads')
  requestUpload(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUploadDto
  ): Promise<UploadResponse> {
    return this.membersService.requestUpload(id, user, dto);
  }

  @Roles('member')
  @Post(':id/edits')
  createEdit(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMemberEditDto
  ): Promise<MemberProfileEditDto> {
    return this.membersService.createEdit(id, user, dto);
  }

  @Get(':id/edits')
  listMyEdits(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<MemberProfileEditDto[]> {
    return this.membersService.listMyEdits(id, user);
  }
}
