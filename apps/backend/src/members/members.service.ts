import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  AdminMemberListItemDto,
  MemberDto,
  MemberListItemDto,
  MemberProfileEditDto,
  RenewalDueState,
  UploadResponse,
} from '@shared/member';
import { CreateMemberEditDto } from './dto/create-member-edit.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { ReviewMemberEditDto } from './dto/review-member-edit.dto';
import { UpdateAdminMemberDto } from './dto/update-admin-member.dto';
import {
  MembersRepository,
  type MemberProfileEditRow,
  type MemberProfileRow,
  type MemberProfileUpdate,
  type ProfileIdentityRow,
} from './members.repository';

// Maps a self-edit section to its jsonb column on member_profiles.
const SECTION_TO_COLUMN = {
  work_experiences: 'work_experiences',
  education: 'educations',
  engagements: 'engagements',
  testimonials: 'testimonials',
  awards: 'awards',
  key_clients: 'key_clients',
} as const;

// Membership runs 12 months from membership_started_at; flagged "due-soon" 30 days out.
const RENEWAL_PERIOD_MONTHS = 12;
const RENEWAL_REMINDER_DAYS = 30;

@Injectable()
export class MembersService {
  constructor(private readonly membersRepository: MembersRepository) {}

  async list(query: {
    q?: string;
    practiceAreaId?: string[];
    country?: string[];
    rateMinCents?: number;
    rateMaxCents?: number;
    sort?: string;
    page?: number;
    pageSize?: number;
  }): Promise<MemberListItemDto[]> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 8;

    let rows = await this.membersRepository.findActiveList(
      { country: query.country, rateMinCents: query.rateMinCents, rateMaxCents: query.rateMaxCents, q: query.q, sort: query.sort },
      { from: (page - 1) * pageSize, to: page * pageSize - 1 }
    );

    if (query.practiceAreaId && query.practiceAreaId.length > 0) {
      const matchedIds = await this.membersRepository.findMemberIdsByPracticeAreas(query.practiceAreaId);
      rows = rows.filter((r) => matchedIds.has(r.profile_id));
    }

    const [profilesById, servicesByMember] = await Promise.all([
      this.membersRepository.findProfilesByIds(rows.map((r) => r.profile_id)),
      this.membersRepository.findMemberServicesByMemberIds(rows.map((r) => r.profile_id)),
    ]);

    let items = rows.map((row) => this.toListDto(row, profilesById, servicesByMember));

    if (query.q) {
      const q = query.q.toLowerCase();
      items = items.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.headline ?? '').toLowerCase().includes(q) ||
          (m.firmName ?? '').toLowerCase().includes(q)
      );
    }

    return items;
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<MemberDto> {
    const row = await this.membersRepository.findDetailByProfileId(id);

    if (!row || (row.status !== 'active' && row.profile_id !== user.id)) {
      throw new NotFoundException('Member profile not found.');
    }

    const [profilesById, servicesByMember] = await Promise.all([
      this.membersRepository.findProfilesByIds([row.profile_id]),
      this.membersRepository.findMemberServicesByMemberIds([row.profile_id]),
    ]);

    return {
      ...this.toListDto(row, profilesById, servicesByMember),
      firmWebsite: row.firm_website,
      availabilityNotes: row.availability_notes,
      isAvailable: row.is_available,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      linkedinUrl: row.linkedin_url,
      website: row.website,
      workExperiences: row.work_experiences ?? [],
      educations: row.educations ?? [],
      engagements: row.engagements ?? [],
      qualifications: row.qualifications ?? [],
      credentials: row.credentials ?? [],
      testimonials: row.testimonials ?? [],
      awards: row.awards ?? [],
      keyClients: row.key_clients ?? [],
    };
  }

  async requestUpload(memberId: string, user: AuthenticatedUser, dto: CreateUploadDto): Promise<UploadResponse> {
    this.assertOwner(memberId, user);

    const path = `${memberId}/${Date.now()}-${dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const data = await this.membersRepository.createSignedUploadUrl(path);
    return { uploadUrl: data.signedUrl, path: data.path };
  }

  async createEdit(memberId: string, user: AuthenticatedUser, dto: CreateMemberEditDto): Promise<MemberProfileEditDto> {
    this.assertOwner(memberId, user);
    this.validateEditPayloadShape(dto);

    const inserted = await this.membersRepository.insertEdit({
      member_id: memberId,
      section: dto.section,
      payload: dto.payload,
      proof_file_url: dto.proofFileUrl ?? null,
      proof_link: dto.proofLink ?? null,
    });

    return this.toEditDto(inserted, user.firstName + ' ' + user.lastName);
  }

  async listMyEdits(memberId: string, user: AuthenticatedUser): Promise<MemberProfileEditDto[]> {
    this.assertOwner(memberId, user);

    const rows = await this.membersRepository.findEditsByMember(memberId);
    return rows.map((row) => this.toEditDto(row, user.firstName + ' ' + user.lastName));
  }

  // ---------------------------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------------------------

  async adminList(): Promise<AdminMemberListItemDto[]> {
    const memberRows = await this.membersRepository.adminFindAllProfiles();

    const [profilesById, servicesByMember] = await Promise.all([
      this.membersRepository.findProfilesByIds(memberRows.map((r) => r.profile_id)),
      this.membersRepository.findMemberServicesByMemberIds(memberRows.map((r) => r.profile_id)),
    ]);

    return memberRows.map((row) => ({
      ...this.toListDto(row, profilesById, servicesByMember),
      status: row.status,
      applicationId: row.application_id,
      membershipStartedAt: row.membership_started_at,
      renewalPaymentStatus: row.renewal_payment_status,
      renewalDueState: this.computeDueState(row.membership_started_at),
    }));
  }

  async adminUpdateMember(id: string, dto: UpdateAdminMemberDto): Promise<AdminMemberListItemDto> {
    const patch: MemberProfileUpdate = {};
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.membershipStartedAt !== undefined) patch.membership_started_at = dto.membershipStartedAt;
    if (dto.renewalPaymentStatus !== undefined) patch.renewal_payment_status = dto.renewalPaymentStatus;

    const updated = await this.membersRepository.adminUpdateProfile(id, patch);

    const [profilesById, servicesByMember] = await Promise.all([
      this.membersRepository.findProfilesByIds([updated.profile_id]),
      this.membersRepository.findMemberServicesByMemberIds([updated.profile_id]),
    ]);

    return {
      ...this.toListDto(updated, profilesById, servicesByMember),
      status: updated.status,
      applicationId: updated.application_id,
      membershipStartedAt: updated.membership_started_at,
      renewalPaymentStatus: updated.renewal_payment_status,
      renewalDueState: this.computeDueState(updated.membership_started_at),
    };
  }

  async adminListEdits(status?: string): Promise<MemberProfileEditDto[]> {
    const rows = await this.membersRepository.findAllEditsByStatus(status ?? 'pending');
    const profilesById = await this.membersRepository.findProfilesByIds(rows.map((r) => r.member_id));
    return rows.map((row) => this.toEditDto(row, this.fullName(profilesById.get(row.member_id))));
  }

  async adminReviewEdit(id: string, admin: AuthenticatedUser, dto: ReviewMemberEditDto): Promise<MemberProfileEditDto> {
    const edit = await this.membersRepository.findEditById(id);
    if (edit.status !== 'pending') {
      throw new ConflictException('This edit has already been reviewed.');
    }

    if (dto.status === 'verified') {
      await this.applyEdit(edit);
    }

    const updated = await this.membersRepository.updateEditDecision(id, {
      status: dto.status,
      review_note: dto.reviewNote ?? null,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    });

    const profilesById = await this.membersRepository.findProfilesByIds([updated.member_id]);
    return this.toEditDto(updated, this.fullName(profilesById.get(updated.member_id)));
  }

  // ---------------------------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------------------------

  private assertOwner(memberId: string, user: AuthenticatedUser): void {
    if (user.id !== memberId) {
      throw new ForbiddenException('You can only edit your own member profile.');
    }
  }

  // Replaces the section's rows on approval; headline_bio/contact overwrite columns directly.
  private async applyEdit(edit: MemberProfileEditRow): Promise<void> {
    const { member_id: memberId, section, payload } = edit;

    if (section === 'headline_bio') {
      const p = payload as { headline: string; bio: string };
      await this.membersRepository.applyHeadlineBioEdit(memberId, p.headline, p.bio);
      return;
    }

    if (section === 'contact') {
      const p = payload as {
        contactEmail: string | null;
        contactPhone: string | null;
        linkedinUrl: string | null;
        website: string | null;
      };
      await this.membersRepository.applyContactEdit(memberId, p);
      return;
    }

    const column = SECTION_TO_COLUMN[section as keyof typeof SECTION_TO_COLUMN];
    if (!column) throw new BadRequestException(`Unknown edit section: ${section}`);

    const items = (payload as Record<string, unknown>[]).map((item) => ({ id: randomUUID(), ...item }));
    await this.membersRepository.applySectionEdit(memberId, column, section, items);
  }

  private validateEditPayloadShape(dto: CreateMemberEditDto): void {
    if (dto.section === 'headline_bio') {
      const p = dto.payload as { headline?: unknown; bio?: unknown };
      if (typeof p.headline !== 'string' || typeof p.bio !== 'string') {
        throw new BadRequestException('headline_bio payload requires headline and bio strings.');
      }
      return;
    }
    if (dto.section === 'contact') {
      return; // all fields nullable — nothing to require
    }
    if (!Array.isArray(dto.payload)) {
      throw new BadRequestException(`${dto.section} payload must be an array.`);
    }
  }

  private computeDueState(membershipStartedAt: string): RenewalDueState {
    const start = new Date(membershipStartedAt);
    const due = new Date(start);
    due.setMonth(due.getMonth() + RENEWAL_PERIOD_MONTHS);

    const now = new Date();
    const reminderStart = new Date(due);
    reminderStart.setDate(reminderStart.getDate() - RENEWAL_REMINDER_DAYS);

    if (now >= due) return 'overdue';
    if (now >= reminderStart) return 'due-soon';
    return 'active';
  }

  private fullName(profile?: ProfileIdentityRow): string {
    if (!profile) return 'Unknown member';
    return `${profile.first_name} ${profile.last_name}`.trim();
  }

  private toListDto(
    row: MemberProfileRow,
    profilesById: Map<string, ProfileIdentityRow>,
    servicesByMember: Map<string, { id: string; name: string }[]>
  ): MemberListItemDto {
    const profile = profilesById.get(row.profile_id);
    const initials =
      profile?.initials ?? `${(profile?.first_name ?? '?')[0]}${(profile?.last_name ?? '?')[0]}`.toUpperCase();

    return {
      id: row.profile_id,
      name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown member',
      initials,
      headline: row.headline,
      bio: row.bio,
      firmName: row.firm_name,
      region: row.region,
      country: row.country,
      city: row.city,
      practiceAreas: servicesByMember.get(row.profile_id) ?? [],
      isVerified: row.is_verified,
      memberTier: row.member_tier,
      yearsOfExperience: row.years_of_experience,
      rateMinCents: row.rate_min_cents,
      rateMaxCents: row.rate_max_cents,
      rateCurrency: row.rate_currency,
      photoUrl: row.photo_url ?? profile?.avatar_url ?? null,
    };
  }

  private toEditDto(row: MemberProfileEditRow, memberName: string): MemberProfileEditDto {
    return {
      id: row.id,
      memberId: row.member_id,
      memberName,
      section: row.section,
      payload: row.payload,
      proofFileUrl: row.proof_file_url,
      proofLink: row.proof_link,
      status: row.status,
      reviewNote: row.review_note,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      submittedAt: row.submitted_at,
    };
  }
}
