import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesController } from './categories.controller';
import { AdminCategoriesController } from './admin-categories.controller';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';

@Module({
  imports: [AuthModule],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService, CategoriesRepository],
  exports: [CategoriesService],
})
export class CategoriesModule {}
