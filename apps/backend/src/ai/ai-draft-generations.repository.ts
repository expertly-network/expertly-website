import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';

export type AiDraftGenerationInsert = Database['public']['Tables']['ai_draft_generations']['Insert'];

@Injectable()
export class AiDraftGenerationsRepository {
  private readonly logger = new Logger(AiDraftGenerationsRepository.name);

  constructor(private readonly supabase: SupabaseService) {}

  private generations() {
    return this.supabase.db.from('ai_draft_generations');
  }

  // Fire-and-forget audit log for a completed (success or failure) ai-draft attempt — never
  // throws; a write failure here must not affect the member-facing response. See
  // docs/superpowers/specs/2026-10-03-adaptive-article-ai-flow-design.md §6.
  async insert(row: AiDraftGenerationInsert): Promise<void> {
    try {
      const { error } = await this.generations().insert(row);
      if (error) {
        this.logger.error(`Failed to write ai_draft_generations audit row: ${error.message}`);
      }
    } catch (error) {
      this.logger.error(
        'Failed to write ai_draft_generations audit row',
        error instanceof Error ? error.stack : error
      );
    }
  }

  // Persists every prepared source file (documents and text alike) to the private
  // `ai-draft-sources` bucket, keyed by generation + author so RLS can scope access. Never
  // throws — a Storage failure must not block article generation (same posture as insert()
  // above); any file that fails to upload is simply omitted from the returned array, and the
  // audit row ends up with a partial (or empty) `source_file_paths` list rather than a blocked
  // request.
  async uploadSourceFiles(
    generationId: string,
    authorId: string,
    files: { data: Buffer; filename: string; contentType: string }[]
  ): Promise<string[]> {
    const uploaded: string[] = [];
    for (const [index, file] of files.entries()) {
      const path = `${authorId}/${generationId}/${index}-${file.filename}`;
      try {
        const { error } = await this.supabase.db.storage
          .from('ai-draft-sources')
          .upload(path, file.data, { contentType: file.contentType, upsert: false });
        if (error) {
          this.logger.warn(`Failed to upload source file "${file.filename}" to ai-draft-sources: ${error.message}`);
          continue;
        }
        uploaded.push(path);
      } catch (error) {
        this.logger.warn(
          `Failed to upload source file "${file.filename}" to ai-draft-sources`,
          error instanceof Error ? error.stack : error
        );
      }
    }
    return uploaded;
  }
}
