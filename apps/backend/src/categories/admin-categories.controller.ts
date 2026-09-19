import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresPermission } from '../auth/decorators/require-permission.decorator';
import { CategoryDto } from '@shared/category';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

// 🛡️ manageTaxonomy — direct admin CRUD over the category→service taxonomy.
@Roles('admin')
@RequiresPermission('manageTaxonomy')
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(): Promise<CategoryDto[]> {
    return this.categoriesService.adminList();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<CategoryDto> {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.categoriesService.remove(id);
  }
}
