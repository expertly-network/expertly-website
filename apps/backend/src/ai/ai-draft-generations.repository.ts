import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';

export type AiDraftGenerationInsert = Database['public']['Tables']['ai_draft_generations']['Insert'];
// Admin log list view — every column except the heavy draft/answers payloads.
const LIST_COLUMNS = [
  'id',
  'author_id',
  'status',
  'draft_title',
  'provider',
  'model',
  'latency_ms',
  'error_message',
  'created_at',
] as const;

export interface AiDraftGenerationListRow {
  id: string;
  author_id: string;
  status: 'success' | 'failed';
  draft_title: string | null;
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
  error_message: string | null;
  created_at: string;
}

// Admin detail view — the full audit row.
const DETAIL_COLUMNS = [
  ...LIST_COLUMNS,
  'service_ids',
  'countries',
  'state',
  'source_file_paths',
  'source_links',
  'core_answers',
  'followup_questions',
  'followup_answers',
  'sources',
  'tone',
  'include_visual',
  'extra_instructions',
  'draft_body',
] as const;

export interface AiDraftGenerationDetailRow extends AiDraftGenerationListRow {
  service_ids: string[];
  countries: string[];
  state: string | null;
  source_file_paths: string[];
  source_links: string[];
  core_answers: { notes: string | null; recentDevelopments: string | null; advice: string | null };
  followup_questions: string[];
  followup_answers: { question: string; answer: string }[];
  sources: { url: string; title: string }[];
  tone: string | null;
  include_visual: boolean;
  extra_instructions: string | null;
  draft_body: string | null;
}

// Hard cap on the admin log's list view — no pagination yet (see docs/rest-api.md).
const ADMIN_LIST_LIMIT = 200;

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

  // 🛡️ Admin log list, newest first, optionally narrowed by status and/or author.
  async findForAdmin(filters: { status?: 'success' | 'failed'; authorId?: string }): Promise<AiDraftGenerationListRow[]> {
    let query = this.generations()
      .select(LIST_COLUMNS.join(', '))
      .order('created_at', { ascending: false })
      .limit(ADMIN_LIST_LIMIT);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.authorId) query = query.eq('author_id', filters.authorId);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException('Failed to load AI generations.');
    return (data ?? []) as unknown as AiDraftGenerationListRow[];
  }

  async findByIdOrThrow(id: string): Promise<AiDraftGenerationDetailRow> {
    const { data, error } = await this.generations()
      .select(DETAIL_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load AI generation.');
    if (!data) throw new NotFoundException('AI generation not found.');
    return data as unknown as AiDraftGenerationDetailRow;
  }

  // Just enough to check ownership when an article is saved with an aiGenerationId. Null when
  // no such row exists.
  async findAuthorId(id: string): Promise<string | null> {
    const { data, error } = await this.generations().select('author_id').eq('id', id).maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load AI generation.');
    return data?.author_id ?? null;
  }

  // Short-lived read URLs for private ai-draft-sources objects, for the admin detail page —
  // same posture as MembersRepository.createSignedProofUrls. Paths that can't be signed
  // (deleted, never uploaded) are simply absent from the result.
  async createSignedSourceUrls(paths: string[], expiresInSeconds: number): Promise<Record<string, string>> {
    const unique = [...new Set(paths)];
    if (unique.length === 0) return {};
    const { data, error } = await this.supabase.db.storage
      .from('ai-draft-sources')
      .createSignedUrls(unique, expiresInSeconds);
    if (error) throw new InternalServerErrorException('Failed to sign source file URLs.');
    const urls: Record<string, string> = {};
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl && !entry.error) urls[entry.path] = entry.signedUrl;
    }
    return urls;
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
