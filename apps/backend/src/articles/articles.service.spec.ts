import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { AdminAccessService } from '../auth/admin-access.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ArticleRow, ArticlesRepository } from './articles.repository';
import type { ArticlesService as ArticlesServiceType } from './articles.service';
import type { UpdateArticleDto } from './dto/update-article.dto';

const AUTHOR_ID = 'author-1';
const BODY = `<p>${Array.from({ length: 900 }, (_, i) => `word${i}`).join(' ')}</p>`;

function articleRow(overrides: Partial<ArticleRow> = {}): ArticleRow {
  return {
    id: 'art-1',
    slug: 'tax-tips',
    author_id: AUTHOR_ID,
    status: 'published',
    title: 'Tax tips',
    body: BODY,
    excerpt: 'e',
    ai_summary: 'summary',
    creation_mode: 'manual',
    read_time_minutes: 5,
    cover_image_url: null,
    service_ids: [],
    custom_service_labels: {},
    countries: ['IN'],
    state: null,
    rejection_reason: null,
    created_at: '2026-10-01',
    updated_at: '2026-10-01',
    ...overrides,
  } as ArticleRow;
}

function user(id: string, overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id,
    email: `${id}@example.com`,
    role: 'member',
    status: 'active',
    memberStatus: 'active',
    firstName: 'F',
    lastName: 'L',
    ...overrides,
  };
}

type RepoMock = { [K in keyof ArticlesRepository]: Mock };

// reviewMode is read from the validated env when the service is constructed, so each mode gets a
// fresh module graph with ARTICLES_REVIEW_MODE set first.
async function setup(mode: 'instant' | 'editorial', existing = articleRow(), managesArticles = false) {
  vi.stubEnv('ARTICLES_REVIEW_MODE', mode);
  vi.resetModules();
  const { ArticlesService } = (await import('./articles.service')) as { ArticlesService: typeof ArticlesServiceType };
  const repo = {
    findByIdOrThrow: vi.fn().mockResolvedValue(existing),
    findByIdOrSlugOrThrow: vi.fn().mockResolvedValue(existing),
    isAuthorListed: vi.fn().mockResolvedValue(true),
    updateById: vi.fn(async (_id: string, patch: Partial<ArticleRow>) => ({ ...existing, ...patch })),
    findServiceDetails: vi.fn().mockResolvedValue(new Map()),
    findAuthorsInfo: vi.fn().mockResolvedValue(new Map()),
    updateAiSummary: vi.fn(),
  } as unknown as RepoMock;
  const aiService = { summarizeArticle: vi.fn().mockResolvedValue('s') };
  const adminAccess = { hasFreshPermission: vi.fn().mockResolvedValue(managesArticles) };
  const service = new ArticlesService(
    repo as unknown as ArticlesRepository,
    aiService as never,
    {} as never,
    adminAccess as unknown as AdminAccessService,
    { list: vi.fn().mockResolvedValue([]) } as never
  );
  return { service, repo, adminAccess };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

function patchOf(repo: RepoMock): Record<string, unknown> {
  return repo.updateById.mock.calls[0][1] as Record<string, unknown>;
}

describe('ArticlesService.update — editorial mode', () => {
  it.each<[string, UpdateArticleDto]>([
    ['title', { title: 'Different title' }],
    ['body', { body: BODY.replace('word1 ', 'changed ') }],
    ['countries', { countries: ['US'] }],
    ['cover image', { coverImageUrl: 'https://images.example/new.jpg' }],
    ['services', { serviceIds: [] }],
  ])('sends a published article back to pending_review when the author edits its %s', async (_label, dto) => {
    const { service, repo } = await setup('editorial');
    const result = await service.update('art-1', user(AUTHOR_ID), dto);
    expect(patchOf(repo)).toMatchObject({ status: 'pending_review', rejection_reason: null });
    expect(result.status).toBe('pending_review');
  });

  it('keeps it published when only non-public fields (state) change', async () => {
    const { service, repo } = await setup('editorial');
    await service.update('art-1', user(AUTHOR_ID), { state: 'MH' });
    expect(patchOf(repo)).not.toHaveProperty('status');
  });

  it("keeps the status when a manageArticles admin edits someone else's article", async () => {
    const { service, repo } = await setup('editorial', articleRow(), true);
    await service.update('art-1', user('admin-1', { role: 'admin' }), { title: 'Fixed typo' });
    expect(patchOf(repo)).not.toHaveProperty('status');
  });

  it('routes an explicit re-submission to pending_review', async () => {
    const { service, repo } = await setup('editorial', articleRow({ status: 'draft' }));
    await service.update('art-1', user(AUTHOR_ID), { status: 'pending_review' } as UpdateArticleDto);
    expect(patchOf(repo).status).toBe('pending_review');
  });

  it('leaves a published article published in instant mode', async () => {
    const { service, repo } = await setup('instant');
    await service.update('art-1', user(AUTHOR_ID), { title: 'Different title' });
    expect(patchOf(repo)).not.toHaveProperty('status');
  });

  it("refuses a non-author who isn't an articles admin", async () => {
    const { service, repo } = await setup('editorial');
    await expect(service.update('art-1', user('member-2'), { title: 'x' })).rejects.toMatchObject({
      response: { code: 'ARTICLE_NOT_OWNER' },
    });
    expect(repo.updateById).not.toHaveBeenCalled();
  });

  it('sanitises the body before storing it', async () => {
    const { service, repo } = await setup('instant');
    await service.update('art-1', user(AUTHOR_ID), { body: `${BODY}<script>alert(1)</script>` });
    expect(patchOf(repo).body).not.toContain('<script>');
  });
});

describe('ArticlesService.findOne — visibility', () => {
  it('hides a published article of an unlisted author from non-authors (404)', async () => {
    const { service, repo } = await setup('instant');
    repo.isAuthorListed.mockResolvedValue(false);
    await expect(
      service.findOne('tax-tips', user('reader-1', { role: 'client', memberStatus: null }))
    ).rejects.toMatchObject({
      response: { code: 'ARTICLE_NOT_FOUND' },
    });
    expect(repo.isAuthorListed).toHaveBeenCalledWith(AUTHOR_ID);
  });

  it("serves it to a listed author's readers", async () => {
    const { service } = await setup('instant');
    await expect(service.findOne('tax-tips', user('reader-1', { role: 'client' }))).resolves.toMatchObject({
      id: 'art-1',
    });
  });

  it('still serves it to its own author and to a manageArticles admin', async () => {
    const own = await setup('instant');
    own.repo.isAuthorListed.mockResolvedValue(false);
    await expect(own.service.findOne('tax-tips', user(AUTHOR_ID))).resolves.toMatchObject({ id: 'art-1' });

    const admin = await setup('instant', articleRow(), true);
    admin.repo.isAuthorListed.mockResolvedValue(false);
    await expect(admin.service.findOne('tax-tips', user('admin-1', { role: 'admin' }))).resolves.toMatchObject({
      id: 'art-1',
    });
  });

  it.each(['draft', 'pending_review', 'rejected'])('hides a %s article from other readers', async (status) => {
    const { service } = await setup('instant', articleRow({ status } as Partial<ArticleRow>));
    await expect(service.findOne('tax-tips', user('reader-1', { role: 'client' }))).rejects.toMatchObject({
      response: { code: 'ARTICLE_NOT_FOUND' },
    });
  });
});
