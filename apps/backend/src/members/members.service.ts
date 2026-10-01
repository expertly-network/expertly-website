import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { fromBuffer as sniffFileType } from 'file-type';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  AdminMemberEditsDetailDto,
  AdminMemberListItemDto,
  MemberDto,
  MemberEditStatusFilter,
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
  type MemberProfileDetailRow,
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

// These sections carry proof embedded per item (payload[i].proofAttachments) rather than the
// shared proof_file_url/proof_link columns education/work_experiences use for the whole batch.
const PER_ITEM_PROOF_SECTIONS = ['engagements', 'testimonials', 'awards'] as const;

interface ProofAttachmentInput {
  type?: unknown;
  url?: unknown;
  label?: unknown;
}

const EDIT_STATUS_FILTERS: readonly MemberEditStatusFilter[] = ['pending', 'verified', 'rejected', 'all'];

// Signed proof-file links on the admin review page expire after an hour.
const PROOF_URL_TTL_SECONDS = 60 * 60;

// Key-client logos are copied from the private member-proofs bucket into the public
// application-assets bucket on approval — only real raster images, checked by magic bytes.
const LOGO_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

type EditPayloadItem = Record<string, unknown>;

// Membership runs 12 months from membership_started_at; flagged "due-soon" 30 days out.
const RENEWAL_PERIOD_MONTHS = 12;
const RENEWAL_REMINDER_DAYS = 30;

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(private readonly membersRepository: MembersRepository) {}

  async list(query: {
    q?: string;
    serviceId?: string[];
    categoryId?: string;
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

    if (query.serviceId && query.serviceId.length > 0) {
      const matchedIds = await this.membersRepository.findMemberIdsByServices(query.serviceId);
      rows = rows.filter((r) => matchedIds.has(r.profile_id));
    } else if (query.categoryId) {
      const matchedIds = await this.membersRepository.findMemberIdsByCategory(query.categoryId);
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

  async findOneBySlug(slug: string, user: AuthenticatedUser): Promise<MemberDto> {
    const row = await this.membersRepository.findDetailBySlug(slug);

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
    this.assertOwnedFilePaths(memberId, dto.section, dto.payload, dto.proofFileUrl);

    const inserted = await this.membersRepository.insertEdit({
      member_id: memberId,
      section: dto.section,
      payload: dto.payload,
      proof_file_url: dto.proofFileUrl ?? null,
      proof_link: dto.proofLink ?? null,
    });
    await this.membersRepository.supersedePendingEdits(memberId, dto.section, inserted.id);

    const [dto_] = await this.toEditDtos([inserted]);
    return dto_;
  }

  async listMyEdits(memberId: string, user: AuthenticatedUser): Promise<MemberProfileEditDto[]> {
    this.assertOwner(memberId, user);

    const rows = await this.membersRepository.findEditsByMember(memberId);
    return this.toEditDtos(rows);
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
    const filter = (status ?? 'pending') as MemberEditStatusFilter;
    if (!EDIT_STATUS_FILTERS.includes(filter)) {
      throw new BadRequestException(`status must be one of: ${EDIT_STATUS_FILTERS.join(', ')}.`);
    }
    const rows = await this.membersRepository.findAllEditsByStatus(filter);
    return this.toEditDtos(rows);
  }

  // Everything the per-member review page needs: identity, the live value of every section (for
  // the current-vs-proposed diff), all edits, and signed links for their private proof files.
  async adminGetMemberEdits(memberId: string): Promise<AdminMemberEditsDetailDto> {
    const row = await this.membersRepository.findDetailByProfileId(memberId);
    if (!row) throw new NotFoundException('Member profile not found.');

    const [profilesById, editRows] = await Promise.all([
      this.membersRepository.findProfilesByIds([memberId]),
      this.membersRepository.findEditsByMember(memberId),
    ]);
    const profile = profilesById.get(memberId);
    const [edits, fileUrls] = await Promise.all([
      this.toEditDtos(editRows),
      this.membersRepository.createSignedProofUrls(editRows.flatMap((e) => this.proofPathsOf(e)), PROOF_URL_TTL_SECONDS),
    ]);

    return {
      member: {
        id: row.profile_id,
        slug: row.slug,
        name: this.fullName(profile),
        initials:
          profile?.initials ?? `${(profile?.first_name ?? '?')[0]}${(profile?.last_name ?? '?')[0]}`.toUpperCase(),
        email: profile?.email ?? null,
        photoUrl: row.photo_path ? this.membersRepository.buildPhotoUrl(row.photo_path) : (profile?.avatar_url ?? null),
        status: row.status,
        isVerified: row.is_verified,
      },
      current: this.currentSectionValues(row),
      edits,
      fileUrls,
    };
  }

  async adminReviewEdit(id: string, admin: AuthenticatedUser, dto: ReviewMemberEditDto): Promise<MemberProfileEditDto> {
    const reviewNote = dto.reviewNote?.trim() || null;
    if (dto.status === 'rejected' && !reviewNote) {
      throw new BadRequestException('A reason is required when rejecting an edit — it is shown to the member.');
    }

    const edit = await this.membersRepository.findEditById(id);
    if (edit.status !== 'pending') {
      throw new ConflictException('This edit has already been reviewed.');
    }

    if (dto.status === 'verified') {
      await this.applyEdit(edit);
    }

    const updated = await this.membersRepository.updateEditDecision(id, {
      status: dto.status,
      review_note: reviewNote,
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    });

    const [updatedDto] = await this.toEditDtos([updated]);
    return updatedDto;
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

    // proofAttachments is moderation-only evidence, embedded in the edit payload for review —
    // it must never land in the public member_profiles column the applied item is written to.
    let items: EditPayloadItem[] = (payload as EditPayloadItem[]).map(({ proofAttachments: _proofAttachments, ...item }) => ({
      id: randomUUID(),
      ...item,
    }));
    if (section === 'key_clients') {
      items = await Promise.all(items.map((item) => this.publishClientLogo(memberId, item)));
    }
    await this.membersRepository.applySectionEdit(memberId, column, section, items);
  }

  // A newly uploaded key-client logo sits in the private member-proofs bucket as
  // `logoUploadPath`, but the public profile reads `logoUrl`. On approval, copy the file into the
  // public application-assets bucket (magic-byte checked) and point `logoUrl` at it. Items without
  // a new upload keep whatever `logoUrl` they already had.
  private async publishClientLogo(memberId: string, item: EditPayloadItem): Promise<EditPayloadItem> {
    const { logoUploadPath, ...rest } = item;
    if (typeof logoUploadPath !== 'string' || logoUploadPath.length === 0) {
      return { ...rest, logoUrl: typeof rest.logoUrl === 'string' ? rest.logoUrl : null };
    }
    this.assertOwnedPath(memberId, logoUploadPath);

    const buffer = await this.membersRepository.downloadProofFile(logoUploadPath);
    const sniffed = await sniffFileType(buffer);
    const ext = sniffed ? LOGO_MIME_TO_EXT[sniffed.mime] : undefined;
    const clientName = typeof rest.name === 'string' ? rest.name : 'a client';
    if (!sniffed || !ext) {
      throw new BadRequestException(`The logo for ${clientName} isn't a PNG, JPEG, WebP, or GIF image — reject this edit instead.`);
    }
    if (buffer.length > MAX_LOGO_BYTES) {
      throw new BadRequestException(`The logo for ${clientName} is larger than 2MB — reject this edit instead.`);
    }

    const publicPath = `members/${memberId}/client-logos/${randomUUID()}.${ext}`;
    await this.membersRepository.uploadPublicAsset(publicPath, buffer, sniffed.mime);
    this.logger.log(`Published client logo for member ${memberId} at ${publicPath}`);
    return { ...rest, logoUrl: this.membersRepository.buildPhotoUrl(publicPath) };
  }

  // Every private member-proofs object an edit references.
  private proofPathsOf(edit: MemberProfileEditRow): string[] {
    const paths: string[] = [];
    if (edit.proof_file_url) paths.push(edit.proof_file_url);
    if (Array.isArray(edit.payload)) {
      for (const item of edit.payload as EditPayloadItem[]) {
        if (typeof item.logoUploadPath === 'string' && item.logoUploadPath) paths.push(item.logoUploadPath);
        if (Array.isArray(item.proofAttachments)) {
          for (const a of item.proofAttachments as ProofAttachmentInput[]) {
            if (a.type === 'file' && typeof a.url === 'string' && a.url) paths.push(a.url);
          }
        }
      }
    }
    return paths;
  }

  // Uploads land at `<memberId>/...` (see requestUpload). A submitted edit may only reference its
  // own member's files — otherwise a member could point at someone else's private proof and have
  // it signed for an admin or, via a key-client logo, copied into the public bucket.
  private assertOwnedFilePaths(memberId: string, section: string, payload: unknown, proofFileUrl?: string): void {
    const paths = this.proofPathsOf({
      section,
      payload,
      proof_file_url: proofFileUrl ?? null,
    } as MemberProfileEditRow);
    for (const path of paths) this.assertOwnedPath(memberId, path);
  }

  private assertOwnedPath(memberId: string, path: string): void {
    if (!path.startsWith(`${memberId}/`) || path.includes('..')) {
      throw new BadRequestException('Uploaded files must be your own uploads.');
    }
  }

  private currentSectionValues(row: MemberProfileDetailRow): AdminMemberEditsDetailDto['current'] {
    return {
      headline_bio: { headline: row.headline, bio: row.bio },
      contact: {
        contactEmail: row.contact_email,
        contactPhone: row.contact_phone,
        linkedinUrl: row.linkedin_url,
        website: row.website,
      },
      engagements: row.engagements ?? [],
      education: row.educations ?? [],
      work_experiences: row.work_experiences ?? [],
      key_clients: row.key_clients ?? [],
      testimonials: row.testimonials ?? [],
      awards: row.awards ?? [],
    };
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

    if (PER_ITEM_PROOF_SECTIONS.includes(dto.section as (typeof PER_ITEM_PROOF_SECTIONS)[number])) {
      for (const item of dto.payload as Record<string, unknown>[]) {
        this.validateProofAttachments(dto.section, item.proofAttachments);
      }
    }
  }

  private validateProofAttachments(section: string, value: unknown): void {
    if (value === undefined) return;
    if (!Array.isArray(value)) {
      throw new BadRequestException(`${section} item proofAttachments must be an array.`);
    }
    for (const attachment of value as ProofAttachmentInput[]) {
      const validType = attachment.type === 'file' || attachment.type === 'link';
      const validUrl = typeof attachment.url === 'string' && attachment.url.trim().length > 0;
      const validLabel = typeof attachment.label === 'string' && attachment.label.trim().length > 0;
      if (!validType || !validUrl || !validLabel) {
        throw new BadRequestException(
          `${section} item proofAttachments entries require type ('file'|'link'), url, and label.`
        );
      }
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
    servicesByMember: Map<string, { id: string; name: string; categoryId: string; categoryName: string }[]>
  ): MemberListItemDto {
    const profile = profilesById.get(row.profile_id);
    const initials =
      profile?.initials ?? `${(profile?.first_name ?? '?')[0]}${(profile?.last_name ?? '?')[0]}`.toUpperCase();

    return {
      id: row.profile_id,
      slug: row.slug,
      name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown member',
      initials,
      headline: row.headline,
      bio: row.bio,
      firmName: row.firm_name,
      region: row.region,
      country: row.country,
      city: row.city,
      services: servicesByMember.get(row.profile_id) ?? [],
      isVerified: row.is_verified,
      memberTier: row.member_tier,
      yearsOfExperience: row.years_of_experience,
      rateMinCents: row.rate_min_cents,
      rateMaxCents: row.rate_max_cents,
      rateCurrency: row.rate_currency,
      photoUrl: row.photo_path ? this.membersRepository.buildPhotoUrl(row.photo_path) : (profile?.avatar_url ?? null),
    };
  }

  // Batch-resolves member name/slug/photo for a set of edit rows.
  private async toEditDtos(rows: MemberProfileEditRow[]): Promise<MemberProfileEditDto[]> {
    const memberIds = rows.map((r) => r.member_id);
    const [profilesById, summaries] = await Promise.all([
      this.membersRepository.findProfilesByIds([...new Set(memberIds)]),
      this.membersRepository.findSlugAndPhotoByProfileIds(memberIds),
    ]);
    return rows.map((row) => {
      const profile = profilesById.get(row.member_id);
      const summary = summaries.get(row.member_id);
      const photoUrl = summary?.photo_path
        ? this.membersRepository.buildPhotoUrl(summary.photo_path)
        : (profile?.avatar_url ?? null);
      return this.toEditDto(row, this.fullName(profile), summary?.slug ?? null, photoUrl);
    });
  }

  private toEditDto(
    row: MemberProfileEditRow,
    memberName: string,
    memberSlug: string | null,
    memberPhotoUrl: string | null
  ): MemberProfileEditDto {
    return {
      id: row.id,
      memberId: row.member_id,
      memberName,
      memberSlug,
      memberPhotoUrl,
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
