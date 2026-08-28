import { BadRequestException, Body, Controller, Get, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ApplicationDto, LinkedInImportResponse } from '@shared/membership-application';
import { ApplicationsService } from './applications.service';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { LinkedInImportRequestDto } from './dto/linkedin-import-request.dto';
import { UploadApplicationFileDto } from './dto/upload-application-file.dto';

// every route requires Auth at minimum
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly service: ApplicationsService) { }

  // Owner — upsert. Creates the caller's draft on first call, updates it on repeat calls
  @Post('me')
  saveOrSubmit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApplicationDto
  ): Promise<ApplicationDto> {
    return this.service.saveOrSubmit(user, dto);
  }

  // Owner — always the caller's own most recent application.
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<ApplicationDto> {
    return this.service.findMine(user.id);
  }

  // pure fetch-and-normalize, doesn't touch the draft.
  @Post('me/linkedin-import')
  importLinkedIn(@Body() dto: LinkedInImportRequestDto): Promise<LinkedInImportResponse> {
    return this.service.importFromLinkedIn(dto.linkedinUrl);
  }

  // 🔒 Owner kind validated against an allow-list by UploadApplicationFileDto.
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
