import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import type { AdminArticleListItemDto, ArticleDto, ArticleStatus } from '@shared/article';
import { ArticlesService } from './articles.service';
import { AdminArticleReviewDto } from './dto/admin-article-review.dto';

// 🛡️ manageArticles — the editorial review queue.
@Roles('admin')
@RequiresPermission('manageArticles')
@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  // Defaults to the review queue (pending_review) when status is omitted.
  @Get()
  list(@Query('status') status?: ArticleStatus): Promise<AdminArticleListItemDto[]> {
    return this.articlesService.listForReview(status);
  }

  @Patch(':id')
  review(@Param('id') id: string, @Body() dto: AdminArticleReviewDto): Promise<ArticleDto> {
    return this.articlesService.review(id, dto);
  }
}
