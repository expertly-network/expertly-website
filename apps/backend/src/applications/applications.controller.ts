import { BadRequestException, Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ApplicationDto, LinkedInImportResponse } from '@shared/membership-application';
import { ApplicationsService } from './applications.service';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { LinkedInImportRequestDto } from './dto/linkedin-import-request.dto';
import { UploadApplicationFileDto } from './dto/upload-application-file.dto';

// No @Public() on this controller — every route requires 🔑 Auth at minimum
// (enforced by the global SupabaseAuthGuard). Every route further restricts to
// exactly role='client' inside the service (see the comment there for why
// that isn't expressed via @Roles()).
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) {}

  // 🔒 Owner — upsert. Creates the caller's draft on first call, updates it on
  // repeat calls, transitions draft -> submitted when the body says so. Never
  // accepts an id — always the caller's own application (see service for why).
  @Post('me')
  saveOrSubmit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApplicationDto
  ): Promise<ApplicationDto> {
    return this.service.saveOrSubmit(user, dto);
  }

  // 🔒 Owner — always the caller's own most recent application, never accepts
  // an id, so there's no cross-user access surface to guard against.
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<ApplicationDto> {
    return this.service.findMine(user.id);
  }

  // 🔒 Auth only — pure fetch-and-normalize, doesn't touch the draft (frontend
  // merges the result client-side and saves it through POST /me like any
  // other edit — see docs/superpowers/specs/2026-08-23-member-application-form-design.md §5).
  @Post('me/linkedin-import')
  importLinkedIn(@Body() dto: LinkedInImportRequestDto): Promise<LinkedInImportResponse> {
    return this.service.importFromLinkedIn(dto.linkedinUrl);
  }

  // 🔒 Owner — kind validated against an allow-list by UploadApplicationFileDto; ownership and
  // MIME/size validation happen in the service (magic bytes, not the client-declared
  // content-type — see the service for why this proxies through the backend at all).
  @Post('me/uploads')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024 } }))
  uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadApplicationFileDto,
    @UploadedFile() file?: Express.Multer.File
  ): Promise<ApplicationDto> {
    if (!file) throw new BadRequestException('No file provided.');
    return this.service.uploadFile(user, dto.kind, file);
  }
}
