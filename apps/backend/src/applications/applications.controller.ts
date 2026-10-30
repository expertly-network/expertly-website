import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { ApplicationDto, CouponPreviewResponse, LinkedInImportResponse } from '@shared/membership-application';
import { ApplicationsService } from './applications.service';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { LinkedInImportRequestDto, LinkedInPhotoImportRequestDto } from './dto/linkedin-import-request.dto';
import { UploadApplicationFileDto } from './dto/upload-application-file.dto';
import { CouponPreviewDto } from './dto/coupon-preview.dto';
import { RATE_LIMITS, RateLimit } from '../common/rate-limit/rate-limit.decorator';

// Same options as the global ValidationPipe (main.ts), for bodies that arrive inside a multipart
// field and so never pass through it. Failure messages are flattened the same way the pipe does
// (one string per failed constraint), so the error body has the global shape.
const MANUAL_VALIDATION_OPTIONS = { whitelist: true, forbidNonWhitelisted: true } as const;

function validationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((e) => [...Object.values(e.constraints ?? {}), ...validationMessages(e.children ?? [])]);
}

// POST /applications/me — see saveOrSubmit below. Inline rather than in RATE_LIMITS: one route uses it.
const APPLICATION_SAVE_RATE_LIMIT = [
  { limit: 20, windowSeconds: 60 },
  { limit: 60, windowSeconds: 60 * 60 },
  { limit: 200, windowSeconds: 24 * 60 * 60 },
];

// 🔒 Auth — every route requires authentication; role is further restricted to 'client' in the service.
@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  // Creates or updates the caller's own application; may transition draft to submitted.
  // Its own, tighter bucket: a submit with a wrong coupon answers COUPON_INVALID, so without this
  // the route is a coupon oracle that sidesteps the coupon-preview limit. The wizard saves once per
  // step change (not per keystroke), so these numbers leave normal use untouched.
  @RateLimit('application-save', ...APPLICATION_SAVE_RATE_LIMIT)
  @Post('me')
  saveOrSubmit(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateApplicationDto): Promise<ApplicationDto> {
    return this.applicationsService.saveOrSubmit(user, dto);
  }

  // Returns the caller's most recent application.
  @Get('me')
  findMine(@CurrentUser() user: AuthenticatedUser): Promise<ApplicationDto> {
    return this.applicationsService.findMine(user.id);
  }

  // Fetches and normalizes LinkedIn profile data; does not save it.
  @RateLimit('linkedin-import', ...RATE_LIMITS.linkedinImport)
  @Post('me/linkedin-import')
  importLinkedIn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LinkedInImportRequestDto
  ): Promise<LinkedInImportResponse> {
    return this.applicationsService.importFromLinkedIn(user, dto.linkedinUrl);
  }

  // Stateless price calculation — doesn't touch or require a draft application.
  @RateLimit('coupon', ...RATE_LIMITS.coupon)
  @Post('me/coupon-preview')
  previewCoupon(@Body() dto: CouponPreviewDto): CouponPreviewResponse {
    return this.applicationsService.previewCoupon(dto);
  }

  // 🔒 any signed-in user — imports a LinkedIn profile photo into the caller's own draft:
  // `sourceUrl` (media.licdn.com only, from the LinkedIn import) or the linked identity's picture.
  @RateLimit('upload', ...RATE_LIMITS.upload)
  @Post('me/photo/linkedin')
  importLinkedInPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: LinkedInPhotoImportRequestDto
  ): Promise<ApplicationDto> {
    return this.applicationsService.importPhotoFromLinkedIn(user, dto.sourceUrl);
  }

  // Uploads a photo or document file for the caller's draft application.
  @RateLimit('upload', ...RATE_LIMITS.upload)
  @Post('me/uploads')
  async uploadFile(@CurrentUser() user: AuthenticatedUser, @Req() request: FastifyRequest): Promise<ApplicationDto> {
    const part = await request.file();
    if (!part) throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'No file provided.' });

    // Repeated multipart fields are normalized to arrays.
    const kindField = Array.isArray(part.fields.kind) ? part.fields.kind[0] : part.fields.kind;
    const kindValue = kindField && 'value' in kindField ? kindField.value : undefined;

    const dto = plainToInstance(UploadApplicationFileDto, { kind: kindValue });
    const errors = await validate(dto, MANUAL_VALIDATION_OPTIONS);
    if (errors.length > 0)
      throw new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: validationMessages(errors),
      });

    const buffer = await part.toBuffer();
    const file = { buffer, size: buffer.length, originalname: part.filename };
    return this.applicationsService.uploadFile(user, dto.kind, file);
  }
}
