import { BadRequestException, Injectable } from '@nestjs/common';
import type { CategoryDto, ServiceLineDto } from '@shared/category';
import { CategoriesRepository, type CategoryRow, type ServiceLineRow, type ServiceRow } from './categories.repository';

// Where a category goes when an admin creates one without choosing a service line.
const DEFAULT_SERVICE_LINE = 'Other';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly categoriesRepository: CategoriesRepository) {}

  async list(): Promise<CategoryDto[]> {
    const [rows, lines] = await Promise.all([
      this.categoriesRepository.findAllActiveWithServices(),
      this.categoriesRepository.findServiceLines(false),
    ]);
    return this.sortedByLine(rows, lines).map((r) => this.toDto(r, lines));
  }

  async adminList(): Promise<CategoryDto[]> {
    const [rows, lines] = await Promise.all([
      this.categoriesRepository.findAllWithServices(),
      this.categoriesRepository.findServiceLines(false),
    ]);
    return this.sortedByLine(rows, lines).map((r) => this.toDto(r, lines));
  }

  // The full active tree: service lines (in order) with their active categories and services.
  async listServiceLines(): Promise<ServiceLineDto[]> {
    const [lines, categories] = await Promise.all([this.categoriesRepository.findServiceLines(true), this.list()]);
    return lines
      .map((l) => ({
        id: l.id,
        name: l.name,
        sortOrder: l.sortOrder,
        categories: categories.filter((c) => c.serviceLineId === l.id),
      }))
      .filter((l) => l.categories.length > 0);
  }

  // Categories ordered by their line first, then their own sort order — the order every picker shows.
  private sortedByLine<T extends CategoryRow>(rows: T[], lines: ServiceLineRow[]): T[] {
    const lineOrder = new Map(lines.map((l) => [l.id, l.sortOrder]));
    return [...rows].sort(
      (a, b) =>
        (lineOrder.get(a.serviceLineId) ?? 999) - (lineOrder.get(b.serviceLineId) ?? 999) || a.sortOrder - b.sortOrder
    );
  }

  private async resolveServiceLineId(serviceLineId: string | undefined): Promise<string> {
    if (serviceLineId) {
      if (!(await this.categoriesRepository.serviceLineExists(serviceLineId))) {
        throw new BadRequestException({ code: 'SERVICE_LINE_NOT_FOUND', message: 'Unknown service line.' });
      }
      return serviceLineId;
    }
    const fallback = await this.categoriesRepository.findServiceLineIdByName(DEFAULT_SERVICE_LINE);
    if (!fallback) throw new BadRequestException({ code: 'SERVICE_LINE_REQUIRED', message: 'Choose a service line.' });
    return fallback;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryDto> {
    const sortOrder = (await this.categoriesRepository.findMaxSortOrder()) + 1;
    const [serviceLineId, lines] = await Promise.all([
      this.resolveServiceLineId(dto.serviceLineId),
      this.categoriesRepository.findServiceLines(false),
    ]);
    const inserted = await this.categoriesRepository.insert({
      name: dto.name,
      image_url: dto.imageUrl ?? null,
      sort_order: sortOrder,
      service_line_id: serviceLineId,
    });
    return this.toDto({ ...inserted, services: [] }, lines);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryDto> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.imageUrl !== undefined) patch.image_url = dto.imageUrl;
    if (dto.sortOrder !== undefined) patch.sort_order = dto.sortOrder;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;
    if (dto.serviceLineId !== undefined) patch.service_line_id = await this.resolveServiceLineId(dto.serviceLineId);

    const updated = await this.categoriesRepository.updateById(id, patch);
    const [services, lines] = await Promise.all([
      this.categoriesRepository.findServicesByCategoryId(id),
      this.categoriesRepository.findServiceLines(false),
    ]);
    return this.toDto({ ...updated, services }, lines);
  }

  async remove(id: string): Promise<void> {
    return this.categoriesRepository.deleteById(id);
  }

  private toDto(row: CategoryRow & { services: ServiceRow[] }, lines: ServiceLineRow[]): CategoryDto {
    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      imageUrl: row.imageUrl,
      isActive: row.isActive,
      serviceLineId: row.serviceLineId,
      serviceLineName: lines.find((l) => l.id === row.serviceLineId)?.name ?? '',
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
