import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminInterviewDetail,
  InterviewReviewFlagDto,
  InterviewReviewFlagListResponse,
  ReviewFlagStatus,
} from '@shared/interview';
import type {
  AdminMemberServiceEvidenceDto,
  AdminUpdateSubtagsRequest,
  AnchorEntryDto,
  CreateFacetValueRequest,
  FacetKind,
  FacetValueDto,
  FacetValueListResponse,
  FacetValueStatus,
  UpdateFacetValueRequest,
} from '@shared/subtags';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { TranscriptTurn } from './brain/types';
import { InterviewResultsRepository } from './interview-results.repository';
import { InterviewScoringService } from './interview-scoring.service';
import { InterviewsRepository } from './interviews.repository';
import { InterviewsService } from './interviews.service';

@Injectable()
export class InterviewReviewService {
  constructor(
    private readonly repo: InterviewsRepository,
    private readonly results: InterviewResultsRepository,
    private readonly scoring: InterviewScoringService,
    private readonly interviews: InterviewsService
  ) {}

  /** Destructive-action rule: re-read profiles.role instead of trusting the JWT claim. */
  private async assertFreshAdmin(admin: AuthenticatedUser): Promise<void> {
    const fresh = await this.repo.findProfileRole(admin.id);
    if (fresh?.role !== 'admin' || fresh.status !== 'active')
      throw new ForbiddenException({ code: 'ADMIN_REQUIRED', message: 'Admin access is required.' });
  }

  async rescore(id: string): Promise<AdminInterviewDetail> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException({ code: 'INTERVIEW_NOT_FOUND', message: 'Interview not found.' });
    if (row.status !== 'completed')
      throw new ConflictException({
        code: 'INTERVIEW_NOT_COMPLETED',
        message: 'Only completed interviews can be re-scored.',
      });
    const member = await this.repo.loadMemberContext(row.memberId);
    if (!member)
      throw new ConflictException({ code: 'INTERVIEW_MEMBER_INACTIVE', message: 'The member is not active.' });
    const transcript = (await this.repo.listConnections(id)).flatMap((c) =>
      Array.isArray(c.transcript) ? (c.transcript as TranscriptTurn[]) : []
    );
    const { verified } = await this.scoring.scoreAndStore(row, transcript, member);
    await this.repo.updateInterview(id, { verifiedAt: verified ? new Date().toISOString() : null });
    return this.interviews.adminGet(id);
  }

  async listFlags(q: {
    status?: ReviewFlagStatus;
    page?: number;
    pageSize?: number;
  }): Promise<InterviewReviewFlagListResponse> {
    const pageSize = q.pageSize ?? 25;
    const page = q.page ?? 1;
    const { rows, total } = await this.results.listFlags({
      status: q.status,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });
    const names = new Map<string, string>();
    for (const id of new Set(rows.map((r) => r.memberId))) names.set(id, await this.repo.findMemberName(id));
    return { items: rows.map((r) => ({ ...r, memberName: names.get(r.memberId) ?? '' })), total };
  }

  async resolveFlag(
    admin: AuthenticatedUser,
    id: string,
    dto: { status: 'dismissed' | 'confirmed'; note?: string }
  ): Promise<InterviewReviewFlagDto> {
    await this.assertFreshAdmin(admin);
    const flag = await this.results.resolveFlag(id, dto.status, dto.note?.trim() || null, admin.id);
    return { ...flag, memberName: await this.repo.findMemberName(flag.memberId) };
  }

  listMemberSubtags(memberId: string): Promise<AdminMemberServiceEvidenceDto[]> {
    return this.results.listMemberEvidence(memberId);
  }

  /**
   * Validate every requested serviceId has interview evidence for this member BEFORE applying
   * any decision (one read) — the same lesson as Task 13's memberApprove: processing the batch
   * sequentially would leave an earlier valid decision applied even when a later item in the
   * same request is invalid. applyAdminDecision keeps its own not-found check too, as a backstop.
   */
  async decideSubtags(
    admin: AuthenticatedUser,
    memberId: string,
    dto: AdminUpdateSubtagsRequest
  ): Promise<AdminMemberServiceEvidenceDto[]> {
    await this.assertFreshAdmin(admin);
    const known = new Set(await this.results.listEvidenceServiceIds(memberId));
    const unknown = dto.services.map((s) => s.serviceId).filter((id) => !known.has(id));
    if (unknown.length)
      throw new NotFoundException({
        code: 'INTERVIEW_EVIDENCE_NOT_FOUND',
        message: 'No interview evidence for that service.',
      });
    for (const item of dto.services) await this.results.applyAdminDecision(memberId, item);
    return this.results.listMemberEvidence(memberId);
  }

  async listFacetValues(q: {
    facet?: FacetKind;
    status?: FacetValueStatus;
    page?: number;
    pageSize?: number;
  }): Promise<FacetValueListResponse> {
    const pageSize = q.pageSize ?? 50;
    const page = q.page ?? 1;
    return this.results.listFacetValuesAdmin({
      facet: q.facet,
      status: q.status,
      offset: (page - 1) * pageSize,
      limit: pageSize,
    });
  }

  createFacetValue(dto: CreateFacetValueRequest): Promise<FacetValueDto> {
    return this.results.createFacetValue(
      dto.facet,
      dto.label,
      (dto.aliases ?? []).map((a) => a.trim().toLowerCase()).filter(Boolean)
    );
  }

  updateFacetValue(id: string, dto: UpdateFacetValueRequest): Promise<FacetValueDto> {
    return this.results.updateFacetValue(id, dto);
  }

  listAnchorEntries(serviceId: string): Promise<AnchorEntryDto[]> {
    return this.results.listAnchorEntries([serviceId]);
  }
}
