import { Injectable } from '@nestjs/common';
import type { ServiceDto } from '@shared/service';
import { ServicesRepository, type ServiceRow } from './services.repository';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly servicesRepository: ServicesRepository) {}

  async create(categoryId: string, dto: CreateServiceDto): Promise<ServiceDto> {
    const sortOrder = (await this.servicesRepository.findMaxSortOrderInCategory(categoryId)) + 1;
    const inserted = await this.servicesRepository.insert({
      category_id: categoryId,
      name: dto.name,
      is_custom: dto.isCustom ?? false,
      sort_order: sortOrder,
    });
    return this.toDto(inserted);
  }

  async update(id: string, dto: UpdateServiceDto): Promise<ServiceDto> {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.isCustom !== undefined) patch.is_custom = dto.isCustom;
    if (dto.sortOrder !== undefined) patch.sort_order = dto.sortOrder;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    const updated = await this.servicesRepository.updateById(id, patch);
    return this.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    return this.servicesRepository.deleteById(id);
  }

  private toDto(row: ServiceRow): ServiceDto {
    return {
      id: row.id,
      categoryId: row.categoryId,
      name: row.name,
      sortOrder: row.sortOrder,
      isCustom: row.isCustom,
      isActive: row.isActive,
    };
  }
}
