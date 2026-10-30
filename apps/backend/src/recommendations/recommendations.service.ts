import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AdminAccessService } from '../auth/admin-access.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { MemberRecommendationDto } from '@shared/member';
import { CreateRecommendationDto } from './dto/create-recommendation.dto';
import { UpdateRecommendationDto } from './dto/update-recommendation.dto';
import { RecommendationsRepository, type RecommendationRow } from './recommendations.repository';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly repository: RecommendationsRepository,
    private readonly adminAccess: AdminAccessService
  ) {}

  // Any active member may recommend another active member — never themselves.
  async create(
    recipientId: string,
    user: AuthenticatedUser,
    dto: CreateRecommendationDto
  ): Promise<MemberRecommendationDto> {
    if (recipientId === user.id) {
      throw new ForbiddenException({
        code: 'RECOMMENDATION_SELF',
        message: 'You cannot recommend yourself.',
      });
    }

    const author = await this.repository.findMemberStatus(user.id);
    if (!author || author.status !== 'active') {
      throw new ForbiddenException({
        code: 'RECOMMENDATION_AUTHOR_NOT_ACTIVE_MEMBER',
        message: 'Only active members can write recommendations.',
      });
    }

    const recipient = await this.repository.findMemberStatus(recipientId);
    if (!recipient || recipient.status !== 'active') {
      throw new NotFoundException({
        code: 'RECOMMENDATION_RECIPIENT_NOT_FOUND',
        message: 'Member not found.',
      });
    }

    const row = await this.repository.insert(user.id, recipientId, dto.body.trim());
    const [result] = await this.toDtos([row]);
    return result;
  }

  // Everyone signed in sees the visible ones; the recipient (and admins) also see hidden ones.
  async list(recipientId: string, user: AuthenticatedUser): Promise<MemberRecommendationDto[]> {
    const recipient = await this.repository.findMemberStatus(recipientId);
    if (!recipient || (recipient.status !== 'active' && recipientId !== user.id)) {
      throw new NotFoundException({
        code: 'RECOMMENDATION_RECIPIENT_NOT_FOUND',
        message: 'Member not found.',
      });
    }
    const includeHidden = recipientId === user.id || (await this.adminAccess.hasFreshPermission(user, 'manageMembers'));
    return this.toDtos(await this.repository.findByRecipient(recipientId, includeHidden));
  }

  // Only the recommended member can hide/unhide.
  async setHidden(
    recipientId: string,
    recommendationId: string,
    user: AuthenticatedUser,
    dto: UpdateRecommendationDto
  ): Promise<MemberRecommendationDto> {
    const existing = await this.repository.findById(recommendationId);
    if (existing.recipient_id !== recipientId)
      throw new NotFoundException({
        code: 'RECOMMENDATION_NOT_FOUND',
        message: 'Recommendation not found.',
      });
    if (existing.recipient_id !== user.id) {
      throw new ForbiddenException({
        code: 'RECOMMENDATION_NOT_RECIPIENT',
        message: 'Only the recommended member can hide or show this recommendation.',
      });
    }
    const [result] = await this.toDtos([await this.repository.setHidden(recommendationId, dto.isHidden)]);
    return result;
  }

  private async toDtos(rows: RecommendationRow[]): Promise<MemberRecommendationDto[]> {
    const authors = await this.repository.findAuthorSummaries(rows.map((r) => r.author_id));
    return rows.map((row) => {
      const a = authors.get(row.author_id);
      const initials = a?.initials ?? `${(a?.first_name ?? '?')[0]}${(a?.last_name ?? '?')[0]}`.toUpperCase();
      return {
        id: row.id,
        recipientId: row.recipient_id,
        author: {
          id: row.author_id,
          slug: a?.slug ?? '',
          name: a ? `${a.first_name} ${a.last_name}`.trim() : 'Unknown member',
          initials,
          photoUrl: a?.photo_path ? this.repository.buildPhotoUrl(a.photo_path) : (a?.avatar_url ?? null),
        },
        body: row.body,
        isHidden: row.is_hidden,
        createdAt: row.created_at,
      };
    });
  }
}
