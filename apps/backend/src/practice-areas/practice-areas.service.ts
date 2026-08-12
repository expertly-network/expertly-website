import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { PracticeAreaDto } from '@shared/practice-area';

@Injectable()
export class PracticeAreasService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(): Promise<PracticeAreaDto[]> {
    const { data, error } = await this.supabase.db
      .from('practice_areas')
      .select('id, name, category')
      .eq('is_active', true)
      .order('name');

    if (error) throw new InternalServerErrorException('Failed to load practice areas.');
    return data as PracticeAreaDto[];
  }
}
