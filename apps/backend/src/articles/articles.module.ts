import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { CategoriesModule } from '../categories/categories.module';
import { ArticlesController } from './articles.controller';
import { AdminArticlesController } from './admin-articles.controller';
import { AdminAiGenerationsController } from './admin-ai-generations.controller';
import { AdminAiGenerationsService } from './admin-ai-generations.service';
import { ArticlesService } from './articles.service';
import { ArticlesRepository } from './articles.repository';

@Module({
  imports: [AuthModule, AiModule, CategoriesModule],
  controllers: [ArticlesController, AdminArticlesController, AdminAiGenerationsController],
  providers: [ArticlesService, ArticlesRepository, AdminAiGenerationsService],
})
export class ArticlesModule {}
