import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { CategoryDto } from '@shared/category';
import { CategoriesService } from './categories.service';

// 🌐 GET /v1/categories — the full active category→service tree, nested.
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get()
  list(): Promise<CategoryDto[]> {
    return this.categoriesService.list();
  }
}
