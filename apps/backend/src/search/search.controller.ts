import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { SearchRequestDto } from './dto/search-request.dto';
import { SearchThrottlerGuard } from './search-throttler.guard';
import { SearchService } from './search.service';
import type { SearchFeedbackResponse, SearchResponse } from '@shared/search';

@ApiBearerAuth()
@UseGuards(SearchThrottlerGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  // 🔒 Signed in, any role. Natural-language search across members, articles and events; or
  // `action: 'feedback'` to rate an earlier answer. 10/min and 100/hour per user for questions, a separate 30/min for feedback (429 beyond).
  @Post()
  @HttpCode(HttpStatus.OK)
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SearchRequestDto
  ): Promise<SearchResponse | SearchFeedbackResponse> {
    if (dto.action === 'feedback') {
      return this.searchService.feedback(user.id, dto.logId, dto.rating, dto.note);
    }
    return this.searchService.search(user.id, dto.query, { scope: dto.scope, limit: dto.limit });
  }
}
