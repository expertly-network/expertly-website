import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminInterviewDetail,
  InterviewClaimScoreDto,
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
import { redactCardText } from '../search/redaction';
import type { TranscriptTurn } from './brain/types';
import { InterviewResultsRepository, type AdminEvidenceInput } from './interview-results.repository';
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
    if (!row.ledger || !row.plan)
      throw new ConflictException({
        code: 'INTERVIEW_NOT_V2',
        message: 'This interview predates claim ledgers and cannot be re-scored.',
      });
    const member = await this.repo.loadMemberContext(row.memberId);
    if (!member)
      throw new ConflictException({ code: 'INTERVIEW_MEMBER_INACTIVE', message: 'The member is not active.' });
    const transcript = (await this.repo.listConnections(id)).flatMap((c) =>
      Array.isArray(c.transcript) ? (c.transcript as TranscriptTurn[]) : []
    );
    // scoreAndStore -> insertScoring -> interview_store_scoring() atomically supersedes the old
    // scoring's still-open flags and deletes its still-proposed evidence in the same transaction
    // as the is_current swap — no separate cleanup call needed here any more.
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
   * Resolve seed evidence for not-yet-proposed services BEFORE calling the atomic decision rpc:
   * `listEvidenceServiceIds` is a best-effort pre-check (which items need a scoring-derived seed
   * at all) — the rpc re-verifies every decision's serviceId has an evidence row for real, inside
   * the same transaction that applies the decisions, so a bad id still writes nothing. An item for
   * a service with no evidence row (the scorer flagged the claim, so it was never proposed) is
   * resolvable only with `accept: true` and only when the member's current completed interview's
   * current scoring has a claim covering that service; that claim seeds a new `active` evidence row.
   */
  async decideSubtags(
    admin: AuthenticatedUser,
    memberId: string,
    dto: AdminUpdateSubtagsRequest
  ): Promise<AdminMemberServiceEvidenceDto[]> {
    await this.assertFreshAdmin(admin);
    const known = new Set(await this.results.listEvidenceServiceIds(memberId));
    const missing = dto.services.filter((s) => !known.has(s.serviceId));
    const seeds = missing.length ? await this.evidenceFromScoring(memberId, missing) : [];
    await this.results.adminDecideSubtags(memberId, dto.services, seeds);
    return this.results.listMemberEvidence(memberId);
  }

  /** New evidence rows for accepted, not-yet-proposed services; throws 404 if any can't be seeded. */
  private async evidenceFromScoring(
    memberId: string,
    items: AdminUpdateSubtagsRequest['services']
  ): Promise<AdminEvidenceInput[]> {
    const notFound = () =>
      new NotFoundException({
        code: 'INTERVIEW_EVIDENCE_NOT_FOUND',
        message: 'No interview evidence for that service.',
      });
    if (items.some((i) => !i.accept)) throw notFound();
    const interview = await this.repo.findCurrent(memberId);
    const scoring = interview?.status === 'completed' ? await this.results.findCurrentScoring(interview.id) : null;
    if (!interview || !scoring) throw notFound();
    return items.map((item) => {
      const claims = scoring.result.claims;
      const claim: InterviewClaimScoreDto | undefined =
        claims.find((c) => c.creditServiceIds.includes(item.serviceId)) ??
        claims.find((c) => c.serviceIds.includes(item.serviceId));
      const summary = claim
        ? redactCardText((claim.evidenceSummary || claim.claimText).trim())
            .slice(0, 400)
            .trim()
        : '';
      if (!claim || !summary) throw notFound();
      return {
        memberId,
        serviceId: item.serviceId,
        interviewId: interview.id,
        scoringId: scoring.id,
        role: claim.role ?? 0,
        evidence: claim.evidence,
        recencyYear: claim.facets.recencyYear,
        summary,
      };
    });
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
