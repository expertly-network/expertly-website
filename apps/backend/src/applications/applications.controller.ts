import { BadRequestException, Body, Controller, Get, Post, Req } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
// Real (not `import type`) import — Swagger's @ApiResponse needs the actual classes at runtime.
import { ApplicationDto, LinkedInImportResponse } from '@shared/membership-application';
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
  //
  // Multipart form, so @Body() doesn't apply here (Fastify, unlike Express+multer, never
  // populates req.body from a multipart form) — the file comes from request.file() (global
  // 15MB limit registered on the @fastify/multipart plugin in main.ts) and the sibling `kind`
  // field off that same part's .fields, validated by hand against the same DTO the rest of this
  // controller uses via @Body() elsewhere, so the validation rule itself isn't duplicated.
  @Post('me/uploads')
  async uploadFile(@CurrentUser() user: AuthenticatedUser, @Req() request: FastifyRequest): Promise<ApplicationDto> {
    const part = await request.file();
    if (!part) throw new BadRequestException('No file provided.');

    // .fields.kind is a single Multipart normally, only an array if the client repeated the
    // field name — and only a MultipartValue (has `.value`) has anything to read, as opposed to
    // a nested MultipartFile.
    const kindField = Array.isArray(part.fields.kind) ? part.fields.kind[0] : part.fields.kind;
    const kindValue = kindField && 'value' in kindField ? kindField.value : undefined;

    const dto = plainToInstance(UploadApplicationFileDto, { kind: kindValue });
    const errors = await validate(dto);
    if (errors.length > 0) throw new BadRequestException('Invalid or missing `kind` field.');

    const buffer = await part.toBuffer();
    const file = { buffer, size: buffer.length, originalname: part.filename };
    return this.service.uploadFile(user, dto.kind, file);
  }
}
