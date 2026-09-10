import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { PracticeAreasModule } from '../practice-areas/practice-areas.module';
import { ArticlesController } from './articles.controller';
import { AdminArticlesController } from './admin-articles.controller';
import { ArticlesService } from './articles.service';
import { ArticlesRepository } from './articles.repository';

@Module({
  imports: [AuthModule, AiModule, PracticeAreasModule],
  controllers: [ArticlesController, AdminArticlesController],
  providers: [ArticlesService, ArticlesRepository],
})
export class ArticlesModule {}
