import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
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

const RANDOM_PRACTICE_AREA_SAMPLE_SIZE = 3;
const DEFAULT_COVER_IMAGE_QUERY = 'finance legal professional office';

@Controller('articles')
export class ArticlesController {
  constructor(
    private readonly articlesService: ArticlesService,
    private readonly aiService: AiService,
    private readonly unsplashService: UnsplashService,
    private readonly practiceAreasService: PracticeAreasService
  ) {}

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser
  ): Promise<ArticleDto> {
    return this.articlesService.findOne(id, user);
  }

  // 🌐 Public — published articles, optionally filtered to one author.
  @Public()
  @Get()
  list(@Query('authorId') authorId?: string): Promise<ArticleListItemDto[]> {
    return this.articlesService.listPublished(authorId);
  }

  // 🔒 Owner — the caller's own articles regardless of status.
  @Get('me')
  listMe(@CurrentUser() user: AuthenticatedUser): Promise<ArticleListItemDto[]> {
    return this.articlesService.listMine(user);
  }

  // 🔒 member — searches Unsplash for cover image suggestions.
  @Roles('member')
  @Get('cover-images')
  async coverImages(@Query('query') query?: string): Promise<CoverImageSuggestionsResponse> {
    const images = await this.unsplashService.search(query?.trim() || DEFAULT_COVER_IMAGE_QUERY);
    return { images };
  }



  // 🔒 member — generates an AI draft from the wizard's brief and any uploaded source files.
  // Returns the draft only; it's saved separately via create().
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

    const practiceAreaNames = await this.articlesService.resolvePracticeAreaNamesList(dto.practiceAreaIds);
    return this.aiService.generateDraft(dto, practiceAreaNames, sourceFileTexts);
  }

  // 🔒 member — revises the current draft based on requested changes.
  @Roles('member')
  @Post('ai-refine')
  aiRefine(@Body() dto: RefineDraftDto): Promise<AiDraftArticleResponse> {
    return this.aiService.refineDraft(dto);
  }

  // 🔒 member — suggests article title ideas, sampling active practice areas if none are selected.
  @Roles('member')
  @Post('suggest-topics')
  async suggestTopics(@Body() dto: SuggestTopicsDto): Promise<SuggestTopicsResponse> {
    const names = dto.practiceAreaIds?.length
      ? await this.articlesService.resolvePracticeAreaNamesList(dto.practiceAreaIds)
      : await this.sampleActivePracticeAreaNames(RANDOM_PRACTICE_AREA_SAMPLE_SIZE);

    const topics = await this.aiService.suggestTopics(names);
    return { topics };
  }

  private async sampleActivePracticeAreaNames(count: number): Promise<string[]> {
    const all = await this.practiceAreasService.list();
    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((p) => p.name);
  }

  @Roles('member')
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateArticleDto
  ): Promise<ArticleDto> {
    return this.articlesService.create(user, dto);
  }

  @Roles('member')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateArticleDto
  ): Promise<ArticleDto> {
    return this.articlesService.update(id, user, dto);
  }

  @Roles('member')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.articlesService.remove(id, user);
  }
}
