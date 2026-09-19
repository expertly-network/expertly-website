import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';

export type ServiceInsert = Database['public']['Tables']['services']['Insert'];
export type ServiceUpdate = Database['public']['Tables']['services']['Update'];

const SERVICE_COLUMNS = ['id', 'categoryId:category_id', 'name', 'sortOrder:sort_order', 'isCustom:is_custom', 'isActive:is_active'] as const;

export interface ServiceRow {
  id: string;
  categoryId: string;
  name: string;
  sortOrder: number;
  isCustom: boolean;
  isActive: boolean;
}

@Injectable()
export class ServicesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private services() {
    return this.supabase.db.from('services');
  }

  async findMaxSortOrderInCategory(categoryId: string): Promise<number> {
    const { data, error } = await this.services()
      .select('sort_order')
      .eq('category_id', categoryId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load services.');
    return (data?.sort_order as number | undefined) ?? 0;
  }

  async insert(row: ServiceInsert): Promise<ServiceRow> {
    const { data: inserted, error } = await this.services().insert(row).select(SERVICE_COLUMNS.join(', ')).single();
    if (error || !inserted) throw new InternalServerErrorException('Failed to create service.');
    return inserted as unknown as ServiceRow;
  }

  async updateById(id: string, patch: ServiceUpdate): Promise<ServiceRow> {
    const { data: updated, error } = await this.services().update(patch).eq('id', id).select(SERVICE_COLUMNS.join(', ')).maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to update service.');
    if (!updated) throw new NotFoundException('Service not found.');
    return updated as unknown as ServiceRow;
  }

  async deleteById(id: string): Promise<void> {
    const { data, error } = await this.services().delete().eq('id', id).select('id').maybeSingle();
    if (error) {
      if ((error as { code?: string }).code === '23503') {
        throw new ConflictException('Cannot delete a service that members have selected. Deactivate it instead.');
      }
      throw new InternalServerErrorException('Failed to delete service.');
    }
    if (!data) throw new NotFoundException('Service not found.');
  }
}
