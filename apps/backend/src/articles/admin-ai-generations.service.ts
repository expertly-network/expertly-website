import { Injectable } from '@nestjs/common';
import type {
  AdminAiGenerationDetailDto,
  AdminAiGenerationListItemDto,
  AiGenerationLinkedArticle,
  ArticleService,
} from '@shared/article';
import {
  AiDraftGenerationsRepository,
  type AiDraftGenerationListRow,
} from '../ai/ai-draft-generations.repository';
import { ArticlesRepository, type AuthorInfo, type LinkedArticleRow } from './articles.repository';
import { sanitizeArticleBody } from './sanitize-article-body';
import type { AdminAiGenerationsQueryDto } from './dto/admin-ai-generations-query.dto';

// Long enough to open a few files from the detail page, short enough that a copied link to
// possibly-confidential client material doesn't stay live — same idea as member-proofs.
const SOURCE_FILE_URL_TTL_SECONDS = 10 * 60;

// 🛡️ manageArticles — read-only view over the ai_draft_generations audit log: what each member
// gave the AI wizard, what came back, and which article (if any) it was saved as.
@Injectable()
export class AdminAiGenerationsService {
  constructor(
    private readonly generationsRepository: AiDraftGenerationsRepository,
    private readonly articlesRepository: ArticlesRepository
  ) {}

  async list(query: AdminAiGenerationsQueryDto): Promise<AdminAiGenerationListItemDto[]> {
    const rows = await this.generationsRepository.findForAdmin({
      status: query.status,
      authorId: query.authorId,
    });
    const [authors, linkedArticles] = await Promise.all([
      this.articlesRepository.findAuthorsInfo(rows.map((r) => r.author_id)),
      this.articlesRepository.findByAiGenerationIds(rows.map((r) => r.id)),
    ]);
    const articleByGenerationId = indexByGenerationId(linkedArticles);
    return rows.map((row) => toListItem(row, authors, articleByGenerationId));
  }

  async findOne(id: string): Promise<AdminAiGenerationDetailDto> {
    const row = await this.generationsRepository.findByIdOrThrow(id);
    const [authors, linkedArticles, serviceDetails, signedUrls] = await Promise.all([
      this.articlesRepository.findAuthorsInfo([row.author_id]),
      this.articlesRepository.findByAiGenerationIds([row.id]),
      this.articlesRepository.findServiceDetails(row.service_ids),
      this.generationsRepository.createSignedSourceUrls(row.source_file_paths, SOURCE_FILE_URL_TTL_SECONDS),
    ]);

    // followup_questions is the full list asked; followup_answers holds only the answered ones.
    const answerByQuestion = new Map(row.followup_answers.map((qa) => [qa.question, qa.answer]));
    const services: ArticleService[] = row.service_ids
      .filter((serviceId) => serviceDetails.has(serviceId))
      .map((serviceId) => {
        const d = serviceDetails.get(serviceId)!;
        return { id: serviceId, name: d.name, categoryId: d.categoryId, categoryName: d.categoryName };
      });

    return {
      ...toListItem(row, authors, indexByGenerationId(linkedArticles)),
      inputs: {
        notes: row.core_answers.notes ?? null,
        recentDevelopments: row.core_answers.recentDevelopments ?? null,
        advice: row.core_answers.advice ?? null,
        followUps: row.followup_questions.map((question) => ({
          question,
          answer: answerByQuestion.get(question) ?? null,
        })),
        sourceLinks: row.source_links,
        sourceFiles: row.source_file_paths.map((path) => ({
          filename: filenameFromSourcePath(path),
          url: signedUrls[path] ?? null,
        })),
        includeVisual: row.include_visual,
        tone: row.tone,
        extraInstructions: row.extra_instructions,
      },
      output: {
        title: row.draft_title,
        // Already sanitized before it was logged; re-sanitized here because the admin page
        // renders it as HTML.
        body: row.draft_body !== null ? sanitizeArticleBody(row.draft_body) : null,
        sources: row.sources,
        services,
        countries: row.countries,
        state: row.state,
      },
    };
  }
}

function indexByGenerationId(articles: LinkedArticleRow[]): Map<string, AiGenerationLinkedArticle> {
  return new Map(articles.map((a) => [a.ai_generation_id, { id: a.id, title: a.title, status: a.status }]));
}

function toListItem(
  row: AiDraftGenerationListRow,
  authors: Map<string, AuthorInfo>,
  articleByGenerationId: Map<string, AiGenerationLinkedArticle>
): AdminAiGenerationListItemDto {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: authors.get(row.author_id)?.name ?? 'Expertly Member',
    status: row.status,
    draftTitle: row.draft_title,
    provider: row.provider,
    model: row.model,
    latencyMs: row.latency_ms,
    errorMessage: row.error_message,
    article: articleByGenerationId.get(row.id) ?? null,
    createdAt: row.created_at,
  };
}

// Paths are "<authorId>/<generationId>/<n>-<filename>" (see AiDraftGenerationsRepository.
// uploadSourceFiles) — strip the folders and the index prefix back to the member's filename.
function filenameFromSourcePath(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return base.replace(/^\d+-/, '');
}
