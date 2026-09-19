import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';

export type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

const CATEGORY_COLUMNS = ['id', 'name', 'sortOrder:sort_order', 'imageUrl:image_url', 'isActive:is_active'] as const;
const SERVICE_COLUMNS = ['id', 'categoryId:category_id', 'name', 'sortOrder:sort_order', 'isCustom:is_custom', 'isActive:is_active'] as const;

export interface CategoryRow {
  id: string;
  name: string;
  sortOrder: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface ServiceRow {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  isCustom: boolean;
  isActive: boolean;
}

@Injectable()
export class CategoriesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private categories() {
    return this.supabase.db.from('categories');
  }

  private services() {
    return this.supabase.db.from('services');
  }

  async findAllActiveWithServices(): Promise<(CategoryRow & { services: ServiceRow[] })[]> {
    const [{ data: categories, error: catError }, { data: services, error: svcError }] = await Promise.all([
      this.categories().select(CATEGORY_COLUMNS.join(', ')).eq('is_active', true).order('sort_order'),
      this.services().select(SERVICE_COLUMNS.join(', ')).eq('is_active', true).order('sort_order'),
    ]);
    if (catError || svcError) throw new InternalServerErrorException('Failed to load categories.');
    return this.attachServices(categories as unknown as CategoryRow[], services as unknown as ServiceRow[]);
  }

  async findAllWithServices(): Promise<(CategoryRow & { services: ServiceRow[] })[]> {
    const [{ data: categories, error: catError }, { data: services, error: svcError }] = await Promise.all([
      this.categories().select(CATEGORY_COLUMNS.join(', ')).order('sort_order'),
      this.services().select(SERVICE_COLUMNS.join(', ')).order('sort_order'),
    ]);
    if (catError || svcError) throw new InternalServerErrorException('Failed to load categories.');
    return this.attachServices(categories as unknown as CategoryRow[], services as unknown as ServiceRow[]);
  }

  async findServicesByCategoryId(categoryId: string): Promise<ServiceRow[]> {
    const { data, error } = await this.services().select(SERVICE_COLUMNS.join(', ')).eq('category_id', categoryId).order('sort_order');
    if (error) throw new InternalServerErrorException('Failed to load services.');
    return (data ?? []) as unknown as ServiceRow[];
  }

  private attachServices(categories: CategoryRow[], services: ServiceRow[]): (CategoryRow & { services: ServiceRow[] })[] {
    const byCategory = new Map<string, ServiceRow[]>();
    for (const s of services) {
      const list = byCategory.get(s.categoryId) ?? [];
      list.push(s);
      byCategory.set(s.categoryId, list);
    }
    return categories.map((c) => ({ ...c, services: byCategory.get(c.id) ?? [] }));
  }

  async findMaxSortOrder(): Promise<number> {
    const { data, error } = await this.categories().select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load categories.');
    return (data?.sort_order as number | undefined) ?? 0;
  }

  async insert(row: CategoryInsert): Promise<CategoryRow> {
    const { data: inserted, error } = await this.categories().insert(row).select(CATEGORY_COLUMNS.join(', ')).single();
    if (error || !inserted) throw new InternalServerErrorException('Failed to create category.');
    return inserted as unknown as CategoryRow;
  }

  async updateById(id: string, patch: CategoryUpdate): Promise<CategoryRow> {
    const { data: updated, error } = await this.categories().update(patch).eq('id', id).select(CATEGORY_COLUMNS.join(', ')).maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to update category.');
    if (!updated) throw new NotFoundException('Category not found.');
    return updated as unknown as CategoryRow;
  }

  async deleteById(id: string): Promise<void> {
    const { data, error } = await this.categories().delete().eq('id', id).select('id').maybeSingle();
    if (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException('Cannot delete a category that still has services. Delete or move its services first.');
      }
      throw new InternalServerErrorException('Failed to delete category.');
    }
    if (!data) throw new NotFoundException('Category not found.');
  }
}
