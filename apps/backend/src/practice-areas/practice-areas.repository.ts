import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { PracticeAreaDto } from '@shared/practice-area';

// Aliased in-select (imageUrl:image_url) — the query already produces the exact PracticeAreaDto
// shape, so there's no separate Row type to hand-maintain here.
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
    // Supabase's select() type inference only parses string-literal arguments; a runtime-joined
    // column list is a plain `string`, so the result falls back to an unparseable error type.
    // We already guarantee this query's shape via ACTIVE_PRACTICE_AREA_COLUMNS above.
    return data as unknown as PracticeAreaDto[];
  }
}
