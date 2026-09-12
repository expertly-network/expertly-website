import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ApplicationDto, LinkedInImportResponse } from '@shared/membership-application';
import { ApplicationsService } from './applications.service';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { LinkedInImportRequestDto } from './dto/linkedin-import-request.dto';
import { UploadApplicationFileDto } from './dto/upload-application-file.dto';

// 🔒 Auth — every route requires authentication; role is further restricted to 'client' in the service.
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // Creates or updates the caller's own application; may transition draft to submitted.
  @Post('me')
  saveOrSubmit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateApplicationDto
  ): Promise<ApplicationDto> {
    return this.applicationsService.saveOrSubmit(user, dto);
  }

  // Returns the caller's most recent application.
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<ApplicationDto> {
    return this.applicationsService.findMine(user.id);
  }

  // Fetches and normalizes LinkedIn profile data; does not save it.
  @Post('me/linkedin-import')
  importLinkedIn(@Body() dto: LinkedInImportRequestDto): Promise<LinkedInImportResponse> {
    return this.applicationsService.importFromLinkedIn(dto.linkedinUrl);
  }

  // Uploads a photo or document file for the caller's draft application.
  @Post('me/uploads')
  async uploadFile(@CurrentUser() user: AuthenticatedUser, @Req() request: FastifyRequest): Promise<ApplicationDto> {
    const part = await request.file();
    if (!part) throw new BadRequestException('No file provided.');

    // Repeated multipart fields are normalized to arrays.
    const kindField = Array.isArray(part.fields.kind) ? part.fields.kind[0] : part.fields.kind;
    const kindValue = kindField && 'value' in kindField ? kindField.value : undefined;

    const dto = plainToInstance(UploadApplicationFileDto, { kind: kindValue });
    const errors = await validate(dto);
    if (errors.length > 0) throw new BadRequestException('Invalid or missing `kind` field.');

    const buffer = await part.toBuffer();
    const file = { buffer, size: buffer.length, originalname: part.filename };
    return this.applicationsService.uploadFile(user, dto.kind, file);
  }
}
