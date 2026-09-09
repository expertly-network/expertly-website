import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
// ArticleDto is a real (not `import type`) import — Swagger's @ApiResponse needs the actual
// class at runtime to build a response schema, not just its compile-time shape. ArticleListItemDto
// stays `import type`: it's a derived `Omit<>` type alias, not a class, so there's no runtime
// value to import.
import { AiDraftArticleResponse, ArticleDto, CoverImageSuggestionsResponse, SuggestTopicsResponse } from '@shared/article';
import type { ArticleListItemDto } from '@shared/article';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { AiService } from '../ai/ai.service';
import { AiDraftRequestDto } from '../ai/dto/ai-draft-request.dto';
import { RefineDraftDto } from '../ai/dto/refine-draft.dto';
import { SuggestTopicsDto } from '../ai/dto/suggest-topics.dto';
import { extractSourceFileText } from '../ai/extract-text';
import { UnsplashService } from '../ai/unsplash.service';
import { PracticeAreasService } from '../practice-areas/practice-areas.service';

// Practice areas to sample when suggesting topics/a default cover image before the member has
// selected any themselves (the write flow's title-suggestion chips and initial cover image both
// need *something* to work with from the very first render).
const RANDOM_PRACTICE_AREA_SAMPLE_SIZE = 3;
const DEFAULT_COVER_IMAGE_QUERY = 'finance legal professional office';

@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly service: ArticlesService,
    private readonly ai: AiService,
    private readonly unsplash: UnsplashService,
    private readonly practiceAreas: PracticeAreasService
  ) { }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ArticleDto> {
    return this.service.findOne(id, user);
  }

  // 🌐 Public — the browse grid, published articles only, no body content.
  // `authorId` (optional) narrows to one author's published articles — the
  // member profile page's Articles tab, not a general multi-filter yet.
  @Public()
  @Get()
  list(@Query('authorId') authorId?: string): Promise<ArticleListItemDto[]> {
    return this.service.listPublished(authorId);
  }

  // 🔒 Owner — the caller's own articles regardless of status. `me`, matching
  // applications/me's convention (not `mine` — one word for "the caller's own
  // resource" across the whole API, not two). Must be registered before the
  // `:id` route below or Nest would match "me" as an id param.
  @Get('me')
  listMe(@CurrentUser() user: AuthenticatedUser): Promise<ArticleListItemDto[]> {
    return this.service.listMine(user);
  }

  // 🔒 member — the write flow's "auto-selected cover image" — a live Unsplash search, proxied
  // so the access key stays server-side. `query` omitted/blank falls back to a generic
  // finance/legal query (the form's very first render, before any practice area is selected).
  // Registered before ':id' below for the same reason as 'me' above.
  @Roles('member')
  @Get('cover-images')
  async coverImages(@Query('query') query?: string): Promise<CoverImageSuggestionsResponse> {
    const images = await this.unsplash.search(query?.trim() || DEFAULT_COVER_IMAGE_QUERY);
    return { images };
  }



  // 🔒 member — the AI wizard's "Generate" step. Multipart form, so @Body() doesn't apply (see
  // applications.controller.ts's uploadFile for the same Fastify/@fastify/multipart pattern):
  // one `payload` field carrying the JSON request (validated by hand against AiDraftRequestDto),
  // plus zero or more file parts (source documents, extracted to text — never persisted, see
  // extract-text.ts). Returns the draft only; it isn't saved until the member POSTs it back via
  // create() below (with creationMode: 'ai'). Registered before the ':id' GET route isn't a
  // concern here (different HTTP method), same reasoning as 'me'.
  @Roles('member')
  @Post('ai-draft')
  async aiDraft(@Req() request: FastifyRequest): Promise<AiDraftArticleResponse> {
    let payload: string | undefined;
    const sourceFileTexts: string[] = [];

    for await (const part of request.parts()) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();
        sourceFileTexts.push(await extractSourceFileText(buffer, part.filename));
      } else if (part.fieldname === 'payload') {
        payload = part.value as string;
      }
    }

    if (!payload) throw new BadRequestException('Missing `payload` field.');
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new BadRequestException('`payload` must be valid JSON.');
    }

    const dto = plainToInstance(AiDraftRequestDto, parsed);
    const errors = await validate(dto);
    if (errors.length > 0) throw new BadRequestException('Invalid AI draft request.');

    const practiceAreaNames = await this.service.resolvePracticeAreaNamesList(dto.practiceAreaIds);
    return this.ai.generateDraft(dto, practiceAreaNames, sourceFileTexts);
  }

  // 🔒 member — the AI wizard's "refine" box: re-prompts the model against the current draft
  // plus the member's requested changes. Plain JSON (no files here), unlike ai-draft above.
  @Roles('member')
  @Post('ai-refine')
  aiRefine(@Body() dto: RefineDraftDto): Promise<AiDraftArticleResponse> {
    return this.ai.refineDraft(dto);
  }

  // 🔒 member — the write flow's "Stuck? Try a topic" chip row. `practiceAreaIds` optional: with
  // none selected yet, a random sample of active practice areas stands in so the member still
  // gets ideas before choosing any (same fallback the local-template version used).
  @Roles('member')
  @Post('suggest-topics')
  async suggestTopics(@Body() dto: SuggestTopicsDto): Promise<SuggestTopicsResponse> {
    const names = dto.practiceAreaIds?.length
      ? await this.service.resolvePracticeAreaNamesList(dto.practiceAreaIds)
      : await this.sampleActivePracticeAreaNames(RANDOM_PRACTICE_AREA_SAMPLE_SIZE);

    const topics = await this.ai.suggestTopics(names);
    return { topics };
  }

  private async sampleActivePracticeAreaNames(count: number): Promise<string[]> {
    const all = await this.practiceAreas.list();
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((p) => p.name);
  }

  @Roles('member')
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateArticleDto
  ): Promise<ArticleDto> {
    return this.service.create(user, dto);
  }

  @Roles('member')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateArticleDto
  ): Promise<ArticleDto> {
    return this.service.update(id, user, dto);
  }

  @Roles('member')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.service.remove(id, user);
  }
}
