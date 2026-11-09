import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  AdminInterviewDetail,
  AdminInterviewListItem,
  AdminInterviewListResponse,
  InterviewAssessment,
  InterviewDrafts,
  InterviewTranscriptTurn,
  MyInterviewDto,
  MyInterviewResponse,
  StartInterviewResponse,
} from '@shared/interview';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import { redactCardText } from '../search/redaction';
import type { Json } from '../supabase/database.types';
import { Planner } from './brain/planner';
import { emptyState, type InterviewPlan } from './brain/types';
import { ElevenLabsClient } from './elevenlabs.client';
import { eligibilityOf } from './interview-eligibility';
import { InterviewConfig } from './interview.config';
import { InterviewsRepository, type InterviewRow } from './interviews.repository';
import { hashSessionToken, newSessionToken } from './session-token';
import type { StartInterviewDto } from './dto/start-interview.dto';
import type { UpdateSummaryDto } from './dto/update-summary.dto';
import type { AdminListQueryDto } from './dto/admin-list-query.dto';

const TOKEN_GRACE_SECONDS = 5 * 60;

export function toMyInterviewDto(row: InterviewRow): MyInterviewDto {
  const done = row.status === 'completed';
  return {
    id: row.id,
    status: row.status,
    elapsedSeconds: row.elapsedSeconds,
    reconnectUntil: row.reconnectUntil,
    endedAt: row.endedAt,
    drafts: done ? ((row.drafts as InterviewDrafts | null) ?? null) : null,
    summary: done ? row.summary : null,
    summaryStatus: done ? row.summaryStatus : null,
  };
}

function notEligible(): ForbiddenException {
  return new ForbiddenException({ code: 'INTERVIEW_NOT_ELIGIBLE', message: 'Only active members can take the interview.' });
}

@Injectable()
export class InterviewsService {
  constructor(
    private readonly repo: InterviewsRepository,
    private readonly planner: Planner,
    private readonly elevenLabs: ElevenLabsClient,
    private readonly config: InterviewConfig
  ) {}

  private assertActiveMember(user: AuthenticatedUser): void {
    if (user.role !== 'member' || user.memberStatus !== 'active') throw notEligible();
  }

  async getMine(user: AuthenticatedUser): Promise<MyInterviewResponse> {
    this.assertActiveMember(user);
    const current = await this.repo.findCurrent(user.id);
    const live = current ? await this.repo.findLiveConnection(current.id, new Date().toISOString()) : null;
    return {
      eligibility: eligibilityOf(current, live !== null, Date.now(), this.config.maxSeconds),
      interview: current ? toMyInterviewDto(current) : null,
      consentVersion: this.config.consentVersion,
      maxSeconds: this.config.maxSeconds,
    };
  }

  private async planInto(interview: InterviewRow, memberId: string): Promise<InterviewRow> {
    const member = await this.repo.loadMemberContext(memberId);
    if (!member) throw notEligible();
    const plan: InterviewPlan = await this.planner.plan(member);
    return this.repo.updateInterview(interview.id, {
      plan: plan as unknown as Json,
      state: { ...emptyState(), currentObjectiveId: plan.objectives[0]?.id ?? null } as unknown as Json,
    });
  }

  async start(user: AuthenticatedUser, dto: StartInterviewDto): Promise<StartInterviewResponse> {
    if (!this.config.enabled)
      throw new ServiceUnavailableException({ code: 'INTERVIEW_PROVIDER_UNAVAILABLE', message: 'The interview is not available yet.' });
    this.assertActiveMember(user);
    if (dto.consentVersion !== this.config.consentVersion)
      throw new BadRequestException({ code: 'CONSENT_VERSION_MISMATCH', message: 'Please review the updated consent and try again.' });

    const now = new Date();
    let interview = await this.repo.findCurrent(user.id);
    const live = interview ? await this.repo.findLiveConnection(interview.id, now.toISOString()) : null;
    const eligibility = eligibilityOf(interview, live !== null, now.getTime(), this.config.maxSeconds);
    if (eligibility === 'in_progress')
      throw new ConflictException({ code: 'INTERVIEW_IN_PROGRESS', message: 'Your interview is already running in another window.' });
    if (eligibility === 'processing' || eligibility === 'completed' || eligibility === 'failed')
      throw new ConflictException({ code: 'INTERVIEW_ALREADY_TAKEN', message: 'You have already taken your interview.' });

    if (!interview) {
      interview = await this.repo.insertInterview({ memberId: user.id, consentVersion: dto.consentVersion, consentAt: now.toISOString() });
    }
    // Also covers a previous start that crashed between insert and planning.
    if (!interview.plan) interview = await this.planInto(interview, user.id);

    const remaining = Math.max(0, this.config.maxSeconds - interview.elapsedSeconds);
    if (remaining < 60)
      throw new ConflictException({ code: 'INTERVIEW_TIME_EXHAUSTED', message: 'Your interview time has been used.' });

    const conversationToken = await this.elevenLabs.conversationToken();
    const sessionToken = newSessionToken();
    const connection = await this.repo.insertConnection({
      interviewId: interview.id,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt: new Date(now.getTime() + (remaining + TOKEN_GRACE_SECONDS) * 1000).toISOString(),
    });
    // Set here, not on the first LLM turn, so a second tab sees "in progress" at once.
    await this.repo.updateInterview(interview.id, { status: 'in_progress', reconnectUntil: null });
    return { interviewId: interview.id, connectionId: connection.id, conversationToken, sessionToken, maxSeconds: remaining };
  }

  async end(user: AuthenticatedUser): Promise<void> {
    this.assertActiveMember(user);
    const current = await this.repo.findCurrent(user.id);
    if (!current || !['ready', 'in_progress', 'interrupted'].includes(current.status))
      throw new NotFoundException({ code: 'INTERVIEW_NOT_ACTIVE', message: 'There is no interview to end.' });
    await this.repo.updateInterview(current.id, { status: 'processing', endedAt: new Date().toISOString(), reconnectUntil: null });
  }

  async updateSummary(user: AuthenticatedUser, dto: UpdateSummaryDto): Promise<MyInterviewDto> {
    this.assertActiveMember(user);
    const current = await this.repo.findCurrent(user.id);
    if (!current || current.status !== 'completed')
      throw new ConflictException({ code: 'INTERVIEW_NOT_COMPLETED', message: 'Your interview summary is not ready yet.' });
    if (current.summaryStatus === 'hidden')
      throw new ConflictException({ code: 'INTERVIEW_SUMMARY_HIDDEN', message: 'This summary has been hidden by the GrowXQ team.' });
    const updated = await this.repo.updateInterview(current.id, {
      summary: redactCardText(dto.summary.trim()),
      summaryStatus: dto.approve ? 'approved' : 'pending',
    });
    return toMyInterviewDto(updated);
  }

  // ---- admin ---------------------------------------------------------------------------

  async adminList(q: AdminListQueryDto): Promise<AdminInterviewListResponse> {
    const pageSize = q.pageSize ?? 25;
    const page = q.page ?? 1;
    const { rows, total } = await this.repo.adminList({ status: q.status, offset: (page - 1) * pageSize, limit: pageSize });
    return { items: rows.map((r) => this.toListItem(r, r.memberName)), total };
  }

  private toListItem(r: InterviewRow, memberName: string): AdminInterviewListItem {
    return {
      id: r.id,
      memberId: r.memberId,
      memberName,
      status: r.status,
      elapsedSeconds: r.elapsedSeconds,
      endedAt: r.endedAt,
      hasAssessment: r.assessment !== null,
      createdAt: r.createdAt,
    };
  }

  async adminGet(id: string): Promise<AdminInterviewDetail> {
    const r = await this.repo.findById(id);
    if (!r) throw new NotFoundException({ code: 'INTERVIEW_NOT_FOUND', message: 'Interview not found.' });
    const [memberName, connections] = await Promise.all([this.repo.findMemberName(r.memberId), this.repo.listConnections(id)]);
    const conns = await Promise.all(
      connections.map(async (c) => ({
        id: c.id,
        startedAt: c.startedAt,
        endedAt: c.endedAt,
        durationSeconds: c.durationSeconds,
        transcript: Array.isArray(c.transcript) ? (c.transcript as InterviewTranscriptTurn[]) : [],
        audioUrl: c.audioPath ? await this.repo.signedAudioUrl(c.audioPath, 15 * 60) : null,
      }))
    );
    return {
      ...this.toListItem(r, memberName),
      plan: (r.plan as Record<string, unknown> | null) ?? null,
      state: (r.state as Record<string, unknown>) ?? {},
      drafts: (r.drafts as InterviewDrafts | null) ?? null,
      summary: r.summary,
      summaryStatus: r.summaryStatus,
      assessment: (r.assessment as InterviewAssessment | null) ?? null,
      failureReason: r.failureReason,
      connections: conns,
    };
  }

  async adminRedo(admin: AuthenticatedUser, id: string): Promise<void> {
    const fresh = await this.repo.findProfileRole(admin.id);
    if (fresh?.role !== 'admin' || fresh.status !== 'active')
      throw new ForbiddenException({ code: 'ADMIN_REQUIRED', message: 'Admin access is required.' });
    const r = await this.repo.findById(id);
    if (!r) throw new NotFoundException({ code: 'INTERVIEW_NOT_FOUND', message: 'Interview not found.' });
    if (r.status === 'voided') return;
    if (r.status === 'in_progress')
      throw new ConflictException({ code: 'INTERVIEW_IN_PROGRESS', message: 'The interview is running; wait for it to end.' });
    await this.repo.updateInterview(id, { status: 'voided' });
  }

  async adminSetSummaryHidden(id: string, hidden: boolean): Promise<AdminInterviewDetail> {
    const r = await this.repo.findById(id);
    if (!r) throw new NotFoundException({ code: 'INTERVIEW_NOT_FOUND', message: 'Interview not found.' });
    if (r.status !== 'completed')
      throw new ConflictException({ code: 'INTERVIEW_NOT_COMPLETED', message: 'The interview has no summary yet.' });
    await this.repo.updateInterview(id, { summaryStatus: hidden ? 'hidden' : 'pending' });
    return this.adminGet(id);
  }
}
