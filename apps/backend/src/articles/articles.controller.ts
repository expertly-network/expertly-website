import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { isUUID } from 'class-validator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import {
  AiDraftArticleResponse,
  AiFollowUpQuestionsResponse,
  ArticleDto,
  CoverImageSuggestionsResponse,
  SuggestTopicsResponse,
} from '@shared/article';
import type { ArticleListItemDto } from '@shared/article';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { AiService } from '../ai/ai.service';
import { AiDraftRequestDto } from '../ai/dto/ai-draft-request.dto';
import { AiFollowUpQuestionsDto } from '../ai/dto/ai-followup-questions.dto';
import { RefineDraftDto } from '../ai/dto/refine-draft.dto';
import { SuggestTopicsDto } from '../ai/dto/suggest-topics.dto';
import { prepareSourceFile, type PreparedSourceFile } from '../ai/prepare-source-file';
import { UnsplashService } from '../ai/unsplash.service';
import { CategoriesService } from '../categories/categories.service';
import { RATE_LIMITS, RateLimit } from '../common/rate-limit/rate-limit.decorator';

const RANDOM_SERVICE_SAMPLE_SIZE = 3;

function toArray(value?: string | string[]): string[] | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value : [value];
}

// Rejects a non-UUID up front — Postgres would otherwise fail the uuid cast with a 500.
function assertUuids(name: string, values: (string | undefined)[]): void {
  if (values.some((v) => v !== undefined && !isUUID(v))) {
    throw new BadRequestException({ code: 'VALIDATION_FAILED', message: `${name} must be a UUID.` });
  }
}

function toPositiveInt(name: string, value?: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1)
    throw new BadRequestException({
      code: 'VALIDATION_FAILED',
      message: `${name} must be a positive integer.`,
    });
  return n;
}
// Same options as the global ValidationPipe (main.ts), for bodies that arrive inside a multipart
// field and so never pass through it. Failure messages are flattened the same way the pipe does
// (one string per failed constraint), so the error body has the global shape.
const MANUAL_VALIDATION_OPTIONS = { whitelist: true, forbidNonWhitelisted: true } as const;

function validationMessages(errors: ValidationError[]): string[] {
  return errors.flatMap((e) => [...Object.values(e.constraints ?? {}), ...validationMessages(e.children ?? [])]);
}

const DEFAULT_COVER_IMAGE_QUERY = 'finance legal professional office';

@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly aiService: AiService,
    private readonly unsplashService: UnsplashService,
    private readonly categoriesService: CategoriesService
  ) {}

  // `:idOrSlug` — the article's UUID or its slug (public URLs use the slug).
  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user: AuthenticatedUser): Promise<ArticleDto> {
    return this.articlesService.findOne(idOrSlug, user);
  }

  @Public()
  @Get()
  async list(
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query('authorId') authorId?: string,
    @Query('serviceId') serviceId?: string | string[],
    @Query('country') country?: string | string[],
    @Query('excludeId') excludeId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ): Promise<ArticleListItemDto[]> {
    const serviceIds = toArray(serviceId);
    assertUuids('authorId', [authorId]);
    assertUuids('serviceId', serviceIds ?? []);
    assertUuids('excludeId', [excludeId]);

    const { items, total } = await this.articlesService.listPublished({
      authorId,
      serviceIds,
      countries: toArray(country),
      excludeId,
      page: toPositiveInt('page', page),
      pageSize: toPositiveInt('pageSize', pageSize),
    });
    // Total matches across all pages; the body stays a plain array (no envelope).
    reply.header('X-Total-Count', String(total));
    return items;
  }

  // 🌐 Public teaser of a published article (no body) — what a signed-out visitor sees.
  @Public()
  @Get(':idOrSlug/preview')
  preview(@Param('idOrSlug') idOrSlug: string): Promise<ArticleListItemDto> {
    return this.articlesService.findPublishedPreview(idOrSlug);
  }

  @Get('me')
  listMe(@CurrentUser() user: AuthenticatedUser): Promise<ArticleListItemDto[]> {
    return this.articlesService.listMine(user);
  }

  @Roles('member')
  @RateLimit('cover-images', ...RATE_LIMITS.coverImages)
  @Get('cover-images')
  async coverImages(@Query('query') query?: string): Promise<CoverImageSuggestionsResponse> {
    const images = await this.unsplashService.search(query?.trim().slice(0, 100) || DEFAULT_COVER_IMAGE_QUERY);
    return { images };
  }

  // 🔒 member — analyzes the wizard's step-1 brief and returns 0-10 follow-up questions.
  @Roles('member')
  @RateLimit('ai', ...RATE_LIMITS.ai)
  @Post('ai-followup-questions')
  async aiFollowUpQuestions(@Body() dto: AiFollowUpQuestionsDto): Promise<AiFollowUpQuestionsResponse> {
    const questions = await this.aiService.generateFollowUpQuestions(dto);
    return { questions };
  }

  @Roles('member')
  @RateLimit('ai-draft', ...RATE_LIMITS.aiDraft)
  @Post('ai-draft')
  async aiDraft(
    @Req() request: FastifyRequest,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<AiDraftArticleResponse> {
    let payload: string | undefined;
    const preparedSourceFiles: PreparedSourceFile[] = [];

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        preparedSourceFiles.push(await prepareSourceFile(buffer, part.filename));
      } else if (part.fieldname === 'payload') {
        payload = part.value as string;
      }
    }

    if (!payload)
      throw new BadRequestException({
        code: 'AI_DRAFT_PAYLOAD_MISSING',
        message: 'Missing `payload` field.',
      });
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new BadRequestException({
        code: 'AI_DRAFT_PAYLOAD_INVALID',
        message: '`payload` must be valid JSON.',
      });
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new BadRequestException({
        code: 'AI_DRAFT_PAYLOAD_INVALID',
        message: '`payload` must be a JSON object.',
      });
    const dto = plainToInstance(AiDraftRequestDto, parsed);
    const errors = await validate(dto, MANUAL_VALIDATION_OPTIONS);
    if (errors.length > 0)
      throw new BadRequestException({
        code: 'AI_DRAFT_PAYLOAD_INVALID',
        message: validationMessages(errors),
      });

    // No serviceIds come from the client anymore — the model infers them, picking only from
    // this full active-services candidate list (never trusted beyond what's actually offered).
    const categories = await this.categoriesService.list();
    const candidateServices = categories.flatMap((c) => c.services.map((s) => ({ id: s.id, name: s.name })));
    return this.aiService.generateDraft(dto, candidateServices, preparedSourceFiles, user.id);
  }

  // 🔒 member — revises the current draft based on requested changes.
  @Roles('member')
  @RateLimit('ai', ...RATE_LIMITS.ai)
  @Post('ai-refine')
  aiRefine(@Body() dto: RefineDraftDto): Promise<AiDraftArticleResponse> {
    return this.aiService.refineDraft(dto);
  }

  // 🔒 member — suggests article title ideas, sampling active services if none are selected.
  @Roles('member')
  @RateLimit('ai', ...RATE_LIMITS.ai)
  @Post('suggest-topics')
  async suggestTopics(@Body() dto: SuggestTopicsDto): Promise<SuggestTopicsResponse> {
    const names = dto.serviceIds?.length
      ? await this.articlesService.resolveServiceNamesList(dto.serviceIds)
      : await this.sampleActiveServiceNames(RANDOM_SERVICE_SAMPLE_SIZE);

    const topics = await this.aiService.suggestTopics(names);
    return { topics };
  }

  private async sampleActiveServiceNames(count: number): Promise<string[]> {
    const categories = await this.categoriesService.list();
    const allServices = categories.flatMap((c) => c.services);
    const shuffled = [...allServices].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((s) => s.name);
  }

  @Roles('member')
  @RateLimit('write', ...RATE_LIMITS.write)
  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateArticleDto): Promise<ArticleDto> {
    return this.articlesService.create(user, dto);
  }

  @Roles('member')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateArticleDto
  ): Promise<ArticleDto> {
    return this.articlesService.update(id, user, dto);
  }

  @Roles('member')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.articlesService.remove(id, user);
  }
}
