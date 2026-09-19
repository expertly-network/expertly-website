import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { CategoriesModule } from '../categories/categories.module';
import { ArticlesController } from './articles.controller';
import { AdminArticlesController } from './admin-articles.controller';
import { ArticlesService } from './articles.service';
import { ArticlesRepository } from './articles.repository';

@Module({
  imports: [AuthModule, AiModule, CategoriesModule],
  controllers: [ArticlesController, AdminArticlesController],
  providers: [ArticlesService, ArticlesRepository],
})
export class ArticlesModule {}
