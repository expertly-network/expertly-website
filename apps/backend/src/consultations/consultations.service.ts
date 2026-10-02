import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ConsultationMessageDto, ConsultationRequestDto } from '@shared/consultation-request';
import { ConsultationsRepository, type ConsultationMessageRow } from './consultations.repository';
import { CreateConsultationRequestDto } from './dto/create-consultation-request.dto';
import { UpdateConsultationStatusDto } from './dto/update-consultation-status.dto';
import { CreateConsultationMessageDto } from './dto/create-consultation-message.dto';
import { RateConsultationRequestDto } from './dto/rate-consultation-request.dto';

const DEFAULT_LIMIT = 3;
const DEFAULT_WINDOW_DAYS = 1;
const DEFAULT_PENDING_COOLDOWN_DAYS = 15;
const WINDOW_EPOCH_MS = Date.parse('1970-01-01T08:00:00.000Z');

@Injectable()
export class ConsultationsService {
  constructor(private readonly repository: ConsultationsRepository) {}

  private rateLimit(): number {
    const parsed = Number(process.env.CONSULTATION_REQUEST_LIMIT);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_LIMIT;
  }

  private windowDays(): number {
    const parsed = Number(process.env.CONSULTATION_REQUEST_WINDOW_DAYS);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_WINDOW_DAYS;
  }

  // How long a still-pending request to the same member blocks a new one — not the same knob as
  // the rate limit above (that's a global count across all members; this is per-member, keyed off
  // an unanswered request specifically). Expires on its own after this many days so a member who
  // never responds doesn't block the requester forever.
  private pendingCooldownDays(): number {
    const parsed = Number(process.env.CONSULTATION_PENDING_COOLDOWN_DAYS);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PENDING_COOLDOWN_DAYS;
  }

  // Fixed-size windows of `windowDays` days, anchored to 08:00 UTC against a fixed epoch — not a
  // rolling clock. See docs/superpowers/specs/2026-10-01-consultations-backend-design.md §4.
  private currentWindow(): { startIso: string; resetAt: string } {
    const windowMs = this.windowDays() * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const elapsed = now - WINDOW_EPOCH_MS;
    const windowStart = WINDOW_EPOCH_MS + Math.floor(elapsed / windowMs) * windowMs;
    return {
      startIso: new Date(windowStart).toISOString(),
      resetAt: new Date(windowStart + windowMs).toISOString(),
    };
  }

  private async pendingCooldownStatus(
    requesterId: string,
    memberId: string
  ): Promise<{ blocked: boolean; retryAfter: string | null }> {
    const existingPending = await this.repository.findLatestPendingToMember(requesterId, memberId);
    if (!existingPending) return { blocked: false, retryAfter: null };

    const cooldownMs = this.pendingCooldownDays() * 24 * 60 * 60 * 1000;
    const pendingSinceMs = new Date(existingPending.createdAt).getTime();
    const retryAfter = new Date(pendingSinceMs + cooldownMs);
    return { blocked: Date.now() < retryAfter.getTime(), retryAfter: retryAfter.toISOString() };
  }

  // Both gates a new request to this member can hit — pending-duplicate cooldown (per-member)
  // checked first, then the daily rate limit (global across all members). Shared by create()
  // (enforces it) and checkEligibility() (reports it ahead of time, before the requester has
  // filled out the form at all) — one source of truth so the two can't drift.
  private async eligibility(
    requesterId: string,
    memberId: string
  ): Promise<{ blocked: boolean; reason: 'pending' | 'rate_limited' | null; retryAfter: string | null }> {
    const cooldown = await this.pendingCooldownStatus(requesterId, memberId);
    if (cooldown.blocked) {
      return { blocked: true, reason: 'pending', retryAfter: cooldown.retryAfter };
    }

    const { startIso, resetAt } = this.currentWindow();
    const count = await this.repository.countByRequesterSince(requesterId, startIso);
    if (count >= this.rateLimit()) {
      return { blocked: true, reason: 'rate_limited', retryAfter: resetAt };
    }

    return { blocked: false, reason: null, retryAfter: null };
  }

  // Read-only probe for the frontend to call before even opening the request form — same rules
  // create() enforces, just reported instead of thrown, so the user finds out without filling
  // out the whole form first.
  async checkEligibility(
    requester: AuthenticatedUser,
    memberId: string
  ): Promise<{ blocked: boolean; reason: 'pending' | 'rate_limited' | null; retryAfter: string | null }> {
    return this.eligibility(requester.id, memberId);
  }

  async create(requester: AuthenticatedUser, dto: CreateConsultationRequestDto): Promise<ConsultationRequestDto> {
    if (dto.memberId === requester.id) {
      throw new BadRequestException('You cannot request a consultation with yourself.');
    }

    const target = await this.repository.findProfileRole(dto.memberId);
    if (!target || target.role !== 'member' || target.status !== 'active') {
      throw new BadRequestException('No such member.');
    }
    // Same error/message as the not-a-member case above — don't leak whether a member exists but
    // is deactivated vs. doesn't exist at all.
    if (!(await this.repository.isMemberProfileActive(dto.memberId))) {
      throw new BadRequestException('No such member.');
    }

    // Cross-field rule class-validator can't express on the DTO alone: exactly one of
    // serviceId/customServiceLabel is required. A provided serviceId must actually be one of
    // this member's own offered services — never trust an arbitrary services.id from the client.
    if (dto.serviceId) {
      if (!(await this.repository.isMemberService(dto.memberId, dto.serviceId))) {
        throw new BadRequestException('Selected service is not offered by this member.');
      }
    } else if (!dto.customServiceLabel?.trim()) {
      throw new BadRequestException('Please select a service, or describe it under "Other".');
    }

    const eligibility = await this.eligibility(requester.id, dto.memberId);
    if (eligibility.blocked && eligibility.reason === 'pending') {
      throw new HttpException(
        {
          statusCode: HttpStatus.CONFLICT,
          message: 'You already have a pending request with this member.',
          retryAfter: eligibility.retryAfter,
        },
        HttpStatus.CONFLICT
      );
    }
    if (eligibility.blocked && eligibility.reason === 'rate_limited') {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many consultation requests — try again later.',
          resetAt: eligibility.retryAfter,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    return this.repository.insert({
      requester_id: requester.id,
      member_id: dto.memberId,
      requester_name: dto.name,
      requester_contact_email: dto.email,
      requester_phone: dto.phone,
      message: dto.message,
      service_id: dto.serviceId ?? null,
      custom_service_label: dto.serviceId ? null : (dto.customServiceLabel?.trim() ?? null),
    });
  }

  async findMine(requesterId: string): Promise<ConsultationRequestDto[]> {
    const requests = await this.repository.findByRequesterId(requesterId);
    const withMember = await this.enrichWithMemberInfo(requests);
    return this.enrichWithServiceInfo(withMember);
  }

  async findReceived(member: AuthenticatedUser): Promise<ConsultationRequestDto[]> {
    if (member.role !== 'member') {
      throw new ForbiddenException('Only members receive consultation requests.');
    }
    const requests = await this.repository.findByMemberId(member.id);
    const withRequester = await this.enrichWithRequesterInfo(requests);
    return this.enrichWithServiceInfo(withRequester);
  }

  async updateStatus(
    id: string,
    member: AuthenticatedUser,
    dto: UpdateConsultationStatusDto
  ): Promise<ConsultationRequestDto> {
    const existing = await this.repository.findById(id);
    if (existing.memberId !== member.id) {
      throw new ForbiddenException('You can only update your own consultation requests.');
    }
    const updated = await this.repository.updateStatus(id, dto.status, dto.responseMessage);
    if (!updated) {
      throw new ConflictException('This consultation request has already been decided.');
    }
    return updated;
  }

  // Requester-only — settable once the member has decided (status != 'pending'); the message
  // thread closes to new messages on the requester's side at that point and this replaces it.
  async rateRequest(
    id: string,
    requester: AuthenticatedUser,
    dto: RateConsultationRequestDto
  ): Promise<ConsultationRequestDto> {
    const existing = await this.repository.findById(id);
    if (existing.requesterId !== requester.id) {
      throw new ForbiddenException('You can only rate your own consultation requests.');
    }
    if (existing.status === 'pending') {
      throw new ConflictException('This request has not been decided yet.');
    }
    const updated = await this.repository.updateRating(id, requester.id, dto.rating);
    if (!updated) {
      throw new ConflictException('This request has not been decided yet.');
    }
    return updated;
  }

  async adminList(): Promise<ConsultationRequestDto[]> {
    const requests = await this.repository.findAll();
    const withMember = await this.enrichWithMemberInfo(requests);
    const withRequester = await this.enrichWithRequesterInfo(withMember);
    return this.enrichWithServiceInfo(withRequester);
  }

  async adminUpdateStatus(id: string, dto: UpdateConsultationStatusDto): Promise<ConsultationRequestDto> {
    await this.repository.findById(id);
    const updated = await this.repository.updateStatus(id, dto.status, dto.responseMessage);
    if (!updated) {
      throw new ConflictException('This consultation request has already been decided.');
    }
    return updated;
  }

  // Either participant can read/post — not gated by the request's current status, so the thread
  // stays open for follow-up after a decision.
  private async assertParticipant(requestId: string, user: AuthenticatedUser): Promise<ConsultationRequestDto> {
    const request = await this.repository.findById(requestId);
    if (request.requesterId !== user.id && request.memberId !== user.id) {
      throw new ForbiddenException('You do not have access to this consultation request.');
    }
    return request;
  }

  async listMessages(requestId: string, user: AuthenticatedUser): Promise<ConsultationMessageDto[]> {
    await this.assertParticipant(requestId, user);
    const messages = await this.repository.findMessagesByRequestId(requestId);
    return this.enrichMessages(messages);
  }

  async postMessage(
    requestId: string,
    user: AuthenticatedUser,
    dto: CreateConsultationMessageDto
  ): Promise<ConsultationMessageDto> {
    const request = await this.assertParticipant(requestId, user);
    if (request.status !== 'pending') {
      throw new ConflictException('This conversation has ended — the request has already been decided.');
    }
    const inserted = await this.repository.insertMessage(requestId, user.id, dto.body);
    const [enriched] = await this.enrichMessages([inserted]);
    return enriched;
  }

  private async enrichMessages(messages: ConsultationMessageRow[]): Promise<ConsultationMessageDto[]> {
    const senderIds = [...new Set(messages.map((m) => m.senderId))];
    const profiles = await this.repository.findProfilesByIds(senderIds);
    return messages.map((m) => {
      const profile = profiles.get(m.senderId);
      return {
        ...m,
        senderName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : 'Unknown',
        senderAvatarUrl: profile?.avatarUrl ?? null,
      };
    });
  }

  private async enrichWithMemberInfo(requests: ConsultationRequestDto[]): Promise<ConsultationRequestDto[]> {
    const memberIds = [...new Set(requests.map((r) => r.memberId))];
    const [profiles, firms] = await Promise.all([
      this.repository.findProfilesByIds(memberIds),
      this.repository.findMemberFirmsByProfileIds(memberIds),
    ]);
    return requests.map((r) => {
      const profile = profiles.get(r.memberId);
      const firm = firms.get(r.memberId);
      return {
        ...r,
        memberName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : null,
        memberFirmName: firm?.firmName ?? null,
        memberHeadline: firm?.headline ?? null,
        // member_profiles.photo_path (the member's real uploaded photo) takes priority over
        // profiles.avatar_url, same as MembersRepository's own resolution — avatar_url is empty
        // for most members.
        memberAvatarUrl: firm?.photoPath ? this.repository.buildPhotoUrl(firm.photoPath) : (profile?.avatarUrl ?? null),
        memberCity: firm?.city ?? null,
        memberCountry: firm?.country ?? null,
        memberSlug: firm?.slug ?? null,
      };
    });
  }

  private async enrichWithServiceInfo(requests: ConsultationRequestDto[]): Promise<ConsultationRequestDto[]> {
    const serviceIds = [...new Set(requests.map((r) => r.serviceId).filter((id): id is string => Boolean(id)))];
    const serviceNames = await this.repository.findServiceNamesByIds(serviceIds);
    return requests.map((r) => ({
      ...r,
      serviceName: r.serviceId ? (serviceNames.get(r.serviceId) ?? null) : null,
    }));
  }

  private async enrichWithRequesterInfo(requests: ConsultationRequestDto[]): Promise<ConsultationRequestDto[]> {
    const requesterIds = [...new Set(requests.map((r) => r.requesterId))];
    const [profiles, firms] = await Promise.all([
      this.repository.findProfilesByIds(requesterIds),
      this.repository.findMemberFirmsByProfileIds(requesterIds),
    ]);
    return requests.map((r) => {
      const profile = profiles.get(r.requesterId);
      const isMember = profile?.role === 'member';
      const firm = isMember ? firms.get(r.requesterId) : undefined;
      return {
        ...r,
        requesterIsVerifiedMember: isMember,
        requesterFirmName: firm?.firmName ?? null,
        requesterAvatarUrl: firm?.photoPath ? this.repository.buildPhotoUrl(firm.photoPath) : (profile?.avatarUrl ?? null),
        requesterCity: firm?.city ?? null,
        requesterCountry: firm?.country ?? null,
      };
    });
  }
}
