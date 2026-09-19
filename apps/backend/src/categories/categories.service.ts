import { Injectable } from '@nestjs/common';
import type { CategoryDto } from '@shared/category';
import { CategoriesRepository, type CategoryRow, type ServiceRow } from './categories.repository';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async list(): Promise<CategoryDto[]> {
    const rows = await this.categoriesRepository.findAllActiveWithServices();
    return rows.map((r) => this.toDto(r));
  }

  async adminList(): Promise<CategoryDto[]> {
    const rows = await this.categoriesRepository.findAllWithServices();
    return rows.map((r) => this.toDto(r));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const sortOrder = (await this.categoriesRepository.findMaxSortOrder()) + 1;
    const inserted = await this.categoriesRepository.insert({
      name: dto.name,
      image_url: dto.imageUrl ?? null,
      sort_order: sortOrder,
    });
    return this.toDto({ ...inserted, services: [] });
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.imageUrl !== undefined) patch.image_url = dto.imageUrl;
    if (dto.sortOrder !== undefined) patch.sort_order = dto.sortOrder;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    const updated = await this.categoriesRepository.updateById(id, patch);
    const services = await this.categoriesRepository.findServicesByCategoryId(id);
    return this.toDto({ ...updated, services });
  }

  async remove(id: string): Promise<void> {
    return this.categoriesRepository.deleteById(id);
  }

  private toDto(row: CategoryRow & { services: ServiceRow[] }): CategoryDto {
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      services: row.services.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        name: s.name,
        sortOrder: s.sortOrder,
        isCustom: s.isCustom,
        isActive: s.isActive,
      })),
    };
  }
}
