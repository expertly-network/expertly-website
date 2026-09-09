import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import type { AdminArticleListItemDto, ArticleDto, ArticleStatus } from '@shared/article';
import { ArticlesService } from './articles.service';
import { AdminArticleReviewDto } from './dto/admin-article-review.dto';

// 🛡️ manageArticles — @Roles('admin') for the base role (freshly re-checked by RolesGuard),
// @RequiresPermission('manageArticles') to further narrow to admins whose admin_role actually
// carries it (freshly re-checked by AdminPermissionGuard). Only does anything useful when
// ARTICLES_REVIEW_MODE=editorial (see ArticlesService) — in 'instant' mode the list is always
// empty, since nothing ever reaches 'pending_review'.
@Roles('admin')
@RequiresPermission('manageArticles')
@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly service: ArticlesService) {}

  // `status` narrows to one bucket (e.g. ?status=rejected to audit past decisions); omit for
  // the default review queue (pending_review) — see ArticlesService.listForReview.
  @Get()
  list(@Query('status') status?: ArticleStatus): Promise<AdminArticleListItemDto[]> {
    return this.service.listForReview(status);
  }

  @Patch(':id')
  review(@Param('id') id: string, @Body() dto: AdminArticleReviewDto): Promise<ArticleDto> {
    return this.service.review(id, dto);
  }
}
