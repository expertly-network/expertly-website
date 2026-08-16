import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ArticleDto, ArticleListItemDto } from '@shared/article';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly service: ArticlesService) {}

  // 🌐 Public — the browse grid, published articles only, no body content.
  @Public()
  @Get()
  list(@Query('authorId') authorId?: string): Promise<ArticleListItemDto[]> {
    return this.service.listPublished(authorId);
  }

  // 🔒 Owner — the caller's own articles regardless of status. Must be
  // registered before the `:id` route below or Nest would match "mine" as an
  // id param.
  @Get('mine')
  listMine(@CurrentUser() user: AuthenticatedUser): Promise<ArticleListItemDto[]> {
    return this.service.listMine(user);
  }

  // 🔑 Auth — reading full article content requires being signed in (any
  // role); a draft is further restricted to its owner or admin inside the
  // service. No @Public() here is deliberate.
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<ArticleDto> {
    return this.service.findOne(id, user);
  }

  // member — @Roles('member') already admits admin too via RolesGuard's
  // ranked model (admin rank >= member rank); client is rejected here.
  @Roles('member')
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateArticleDto
  ): Promise<ArticleDto> {
    return this.service.create(user, dto);
  }

  // 🔒 Owner or admin — @Roles('member') rejects client at the guard layer;
  // the finer-grained "must be this article's own author, unless admin"
  // check lives in ArticlesService.
  @Roles('member')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateArticleDto
  ): Promise<ArticleDto> {
    return this.service.update(id, user, dto);
  }

  // 🔒 Owner or admin — same split as update().
  @Roles('member')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.service.remove(id, user);
  }
}
