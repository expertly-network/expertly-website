import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { RecommendationRequestDto, RecommendationRequestPerson } from '@shared/recommendation-request';
import { EmailService } from '../email/email.service';
import { CreateRecommendationRequestDto, UpdateRecommendationRequestDto } from './dto/recommendation-request.dto';
import {
  RecommendationRequestsRepository,
  type PersonRow,
  type RecommendationRequestRow,
} from './recommendation-requests.repository';

/** After an ignored or cancelled request, the same member can't be asked again for this long. */
export const RE_ASK_COOLDOWN_DAYS = 30;
/** A member may have at most this many requests open at once. */
export const MAX_OPEN_REQUESTS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class RecommendationRequestsService {
  private readonly logger = new Logger(RecommendationRequestsService.name);

  constructor(
    private readonly repository: RecommendationRequestsRepository,
    private readonly emailService: EmailService
  ) {}

  async create(
    recipientId: string,
    user: AuthenticatedUser,
    dto: CreateRecommendationRequestDto
  ): Promise<RecommendationRequestDto> {
    if (recipientId === user.id) {
      throw new BadRequestException({
        code: 'RECOMMENDATION_REQUEST_SELF',
        message: 'You cannot ask yourself for a recommendation.',
      });
    }
    const people = await this.repository.findPeople([user.id, recipientId]);
    const requester = people.get(user.id);
    if (!requester) {
      throw new ForbiddenException({
        code: 'RECOMMENDATION_AUTHOR_NOT_ACTIVE_MEMBER',
        message: 'Only active members can request recommendations.',
      });
    }
    const recipient = people.get(recipientId);
    if (!recipient) {
      throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
    }

    if (await this.repository.findPendingPair(user.id, recipientId)) {
      throw new ConflictException({
        code: 'RECOMMENDATION_REQUEST_PENDING',
        message: 'You have already asked this member for a recommendation.',
      });
    }
    if (await this.repository.hasRecommendation(recipientId, user.id)) {
      throw new ConflictException({
        code: 'RECOMMENDATION_ALREADY_GIVEN',
        message: 'This member has already recommended you.',
      });
    }
    const ended = await this.repository.findLatestEndedPair(user.id, recipientId);
    if (ended && Date.now() - new Date(ended.created_at).getTime() < RE_ASK_COOLDOWN_DAYS * DAY_MS) {
      throw new HttpException(
        {
          code: 'RECOMMENDATION_REQUEST_COOLDOWN',
          message: `You can ask this member again ${RE_ASK_COOLDOWN_DAYS} days after your last request.`,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    if ((await this.repository.countOpenByRequester(user.id)) >= MAX_OPEN_REQUESTS) {
      throw new HttpException(
        {
          code: 'RECOMMENDATION_REQUEST_LIMIT',
          message: `You can have at most ${MAX_OPEN_REQUESTS} recommendation requests open at once.`,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    const row = await this.repository.insert(user.id, recipientId, dto.message?.trim() || null);
    try {
      await this.emailService.enqueueAutomation(
        'recommendation_requested',
        { profileId: recipientId, workEmail: recipient.work_email },
        {
          idempotencyKey: `recommendation_requested:${row.id}`,
          variables: { REQUESTER_NAME: `${requester.first_name} ${requester.last_name}`.trim() },
        }
      );
    } catch {
      this.logger.error(`Recommendation request ${row.id}: email enqueue failed`);
    }
    return (await this.toDtos([row], 'sent', people))[0];
  }

  // `received`: pending asks for me. `sent`: everything I asked — an ignored request is reported as
  // pending (the requester is never told it was ignored).
  async list(user: AuthenticatedUser, direction: 'sent' | 'received'): Promise<RecommendationRequestDto[]> {
    const rows =
      direction === 'sent'
        ? await this.repository.listByRequester(user.id)
        : await this.repository.listPendingForRecipient(user.id);
    return this.toDtos(rows, direction);
  }

  async update(
    requestId: string,
    user: AuthenticatedUser,
    dto: UpdateRecommendationRequestDto
  ): Promise<RecommendationRequestDto> {
    const row = await this.repository.findById(requestId);
    // Neither side's id is revealed to a stranger: it simply isn't theirs.
    if (!row || (row.requester_id !== user.id && row.recipient_id !== user.id)) {
      throw new NotFoundException({ code: 'RECOMMENDATION_REQUEST_NOT_FOUND', message: 'Request not found.' });
    }
    const isRecipient = row.recipient_id === user.id;
    if ((dto.action === 'ignore') !== isRecipient) {
      throw new ForbiddenException({
        code: 'RECOMMENDATION_REQUEST_FORBIDDEN',
        message: isRecipient ? 'You can only ignore requests sent to you.' : 'You can only cancel requests you sent.',
      });
    }
    const updated = await this.repository.transitionPending(
      requestId,
      dto.action === 'ignore' ? 'ignored' : 'cancelled'
    );
    if (!updated) {
      throw new ConflictException({
        code: 'RECOMMENDATION_REQUEST_NOT_PENDING',
        message: 'This request is no longer pending.',
      });
    }
    return (await this.toDtos([updated], isRecipient ? 'received' : 'sent'))[0];
  }

  /** The recipient wrote the recommendation: close the request that asked for it. */
  async fulfill(requesterId: string, recipientId: string): Promise<void> {
    await this.repository.fulfillPending(requesterId, recipientId);
  }

  private person(row: PersonRow | undefined, id: string): RecommendationRequestPerson {
    return {
      id,
      slug: row?.slug ?? '',
      name: row ? `${row.first_name} ${row.last_name}`.trim() : 'Unknown member',
      photoUrl: row?.photo_path ? this.repository.buildPhotoUrl(row.photo_path) : (row?.avatar_url ?? null),
      headline: row?.headline ?? null,
    };
  }

  private async toDtos(
    rows: RecommendationRequestRow[],
    direction: 'sent' | 'received',
    known?: Map<string, PersonRow>
  ): Promise<RecommendationRequestDto[]> {
    const people = known ?? (await this.repository.findPeople(rows.flatMap((r) => [r.requester_id, r.recipient_id])));
    return rows.map((row) => ({
      id: row.id,
      requester: this.person(people.get(row.requester_id), row.requester_id),
      recipient: this.person(people.get(row.recipient_id), row.recipient_id),
      message: row.message,
      status: direction === 'sent' && row.status === 'ignored' ? 'pending' : row.status,
      createdAt: row.created_at,
      respondedAt: direction === 'sent' && row.status === 'ignored' ? null : row.responded_at,
    }));
  }
}
