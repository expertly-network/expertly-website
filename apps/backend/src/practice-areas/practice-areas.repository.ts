import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { PracticeAreaDto } from '@shared/practice-area';

const ACTIVE_PRACTICE_AREA_COLUMNS = ['id', 'name', 'category', 'imageUrl:image_url'] as const;

@Injectable()
export class PracticeAreasRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findAllActive(): Promise<PracticeAreaDto[]> {
    const { data, error } = await this.supabase.db
      .from('practice_areas')
      .select(ACTIVE_PRACTICE_AREA_COLUMNS.join(', '))
      .eq('is_active', true)
      .order('name');

    if (error) throw new InternalServerErrorException('Failed to load practice areas.');
    return data as unknown as PracticeAreaDto[];
  }
}
