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
  MemberEditItemDecision,
  MemberEditItemReview,
  AdminMemberListItemDto,
  MemberDto,
  MemberEditStatusFilter,
  MemberListItemDto,
  MemberProfileEditDto,
  MyMemberProfileDto,
  RenewalDueState,
  UploadResponse,
} from '@shared/member';
import { CreateMemberEditDto } from './dto/create-member-edit.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { ReviewMemberEditDto } from './dto/review-member-edit.dto';
import { UpdateAdminMemberDto } from './dto/update-admin-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import {
  ARRAY_SECTIONS,
  PER_ITEM_PROOF_SECTIONS,
  badRequest,
  hasItemProof,
  isArraySection,
  normalizeLiveItem,
  normalizeLiveSection,
  validateAndPrepareEditPayload,
  type SectionItem,
} from './member-sections';
import { assertValidWorkHistory, sortWorkHistoryNewestFirst, type WorkSpan } from '../common/work-history';
import {
  MembersRepository,
  type MemberSelfUpdate,
  type MemberProfileDetailRow,
  type MemberProfileEditInsert,
  type MemberProfileEditRow,
  type MemberProfileEditUpdate,
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

// Member profile photos: same magic-byte check, no GIFs (a profile photo shouldn't animate).
const PHOTO_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type EditPayloadItem = SectionItem;

// Resolved per-item decision used when applying an array-section edit.
interface ItemDecision {
  decision: MemberEditItemDecision;
  reason: string | null;
}

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

    // Every filter is resolved before the paged query — filtering a fetched page afterwards
    // silently dropped matches that sat on later pages.
    let restrictToIds: string[] | undefined;
    if (query.serviceId && query.serviceId.length > 0) {
      restrictToIds = [...(await this.membersRepository.findMemberIdsByServices(query.serviceId))];
    } else if (query.categoryId) {
      restrictToIds = [...(await this.membersRepository.findMemberIdsByCategory(query.categoryId))];
    }
    if (restrictToIds && restrictToIds.length === 0) return [];

    const q = query.q?.trim();
    const qMatchIds = q ? await this.membersRepository.findMemberIdsMatchingText(q) : undefined;

    const rows = await this.membersRepository.findActiveList(
      {
        country: query.country,
        rateMinCents: query.rateMinCents,
        rateMaxCents: query.rateMaxCents,
        q,
        qMatchIds,
        restrictToIds,
        sort: query.sort,
      },
      { from: (page - 1) * pageSize, to: page * pageSize - 1 }
    );

    const [profilesById, servicesByMember] = await Promise.all([
      this.membersRepository.findProfilesByIds(rows.map((r) => r.profile_id)),
      this.membersRepository.findMemberServicesByMemberIds(rows.map((r) => r.profile_id)),
    ]);

    return rows.map((row) => this.toListDto(row, profilesById, servicesByMember));
  }

  async findMine(user: AuthenticatedUser): Promise<MyMemberProfileDto> {
    const found = (await this.membersRepository.findSlugAndPhotoByProfileIds([user.id])).get(user.id);
    if (!found) throw new NotFoundException('You have no member profile yet.');
    return { id: user.id, slug: found.slug };
  }

  async findOneBySlug(slug: string, user: AuthenticatedUser): Promise<MemberDto> {
    const row = await this.membersRepository.findDetailBySlug(slug);

    if (!row || (row.status !== 'active' && row.profile_id !== user.id)) {
      throw new NotFoundException('Member profile not found.');
    }

    return this.toDetailDto(row, user);
  }

  // Full profile shape for GET :slug and PATCH :id. Private proof (and client emails) only for the
  // owning member and admins.
  private async toDetailDto(row: MemberProfileDetailRow, user: AuthenticatedUser): Promise<MemberDto> {
    const [profilesById, servicesByMember] = await Promise.all([
      this.membersRepository.findProfilesByIds([row.profile_id]),
      this.membersRepository.findMemberServicesByMemberIds([row.profile_id]),
    ]);

    const includeProof = row.profile_id === user.id || user.role === 'admin';

    return {
      ...this.toListDto(row, profilesById, servicesByMember),
      firmWebsite: row.firm_website,
      availabilityNotes: row.availability_notes,
      isAvailable: row.is_available,
      contactEmail: row.contact_email,
      workEmail: row.work_email,
      contactPhone: row.contact_phone,
      linkedinUrl: row.linkedin_url,
      website: row.website,
      workExperiences: normalizeLiveSection('work_experiences', row.work_experiences, includeProof) as unknown as MemberDto['workExperiences'],
      educations: normalizeLiveSection('education', row.educations, includeProof) as unknown as MemberDto['educations'],
      engagements: normalizeLiveSection('engagements', row.engagements, includeProof) as unknown as MemberDto['engagements'],
      qualifications: row.qualifications ?? [],
      credentials: row.credentials ?? [],
      testimonials: normalizeLiveSection('testimonials', row.testimonials, includeProof) as unknown as MemberDto['testimonials'],
      awards: normalizeLiveSection('awards', row.awards, includeProof) as unknown as MemberDto['awards'],
      keyClients: normalizeLiveSection('key_clients', row.key_clients, includeProof) as unknown as MemberDto['keyClients'],
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
    const payload = validateAndPrepareEditPayload(dto.section, dto.payload);
    this.assertOwnedFilePaths(memberId, dto.section, payload, dto.proofFileUrl);

    const inserted = await this.membersRepository.insertEdit({
      member_id: memberId,
      section: dto.section,
      payload: payload as MemberProfileEditInsert['payload'],
      proof_file_url: dto.proofFileUrl ?? null,
      proof_link: dto.proofLink ?? null,
    });
    await this.membersRepository.supersedePendingEdits(memberId, dto.section, inserted.id);

    const [dto_] = await this.toEditDtos([inserted]);
    return dto_;
  }

  // PATCH :id — availability and/or photo, applied together and immediately (product decision,
  // 2026-10-21: no admin review for these). A new photo sits in the private member-proofs bucket;
  // it's validated by magic bytes and copied to a fresh public path, so caches never serve the
  // old one. Validation runs before anything is written, so a bad photo leaves availability as-is.
  async updateOwnProfile(memberId: string, user: AuthenticatedUser, dto: UpdateMemberDto): Promise<MemberDto> {
    this.assertOwner(memberId, user);
    if (dto.isAvailable === undefined && dto.availabilityNotes === undefined && dto.photoUploadPath === undefined) {
      throw new BadRequestException({ code: 'NOTHING_TO_UPDATE', message: 'Send at least one field to update.' });
    }

    const patch: MemberSelfUpdate = {};
    if (dto.isAvailable !== undefined) patch.is_available = dto.isAvailable;
    if (dto.availabilityNotes !== undefined) patch.availability_notes = dto.availabilityNotes?.trim() || null;
    if (dto.photoUploadPath !== undefined) patch.photo_path = await this.publishProfilePhoto(memberId, dto.photoUploadPath);

    await this.membersRepository.updateOwnFields(memberId, patch);
    const row = await this.membersRepository.findDetailByProfileId(memberId);
    if (!row) throw new NotFoundException('Member profile not found.');
    return this.toDetailDto(row, user);
  }

  private async publishProfilePhoto(memberId: string, uploadPath: string): Promise<string> {
    this.assertOwnedPath(memberId, uploadPath);
    const buffer = await this.membersRepository.downloadProofFile(uploadPath);
    const sniffed = await sniffFileType(buffer);
    const ext = sniffed ? PHOTO_MIME_TO_EXT[sniffed.mime] : undefined;
    if (!sniffed || !ext) {
      throw new BadRequestException({ code: 'PHOTO_INVALID_TYPE', message: 'Profile photos must be a JPEG, PNG, or WebP image.' });
    }
    if (buffer.length > MAX_PHOTO_BYTES) {
      throw new BadRequestException({ code: 'PHOTO_TOO_LARGE', message: 'Profile photos must be under 5MB.' });
    }
    const publicPath = `members/${memberId}/profile-photo-${randomUUID()}.${ext}`;
    await this.membersRepository.uploadPublicAsset(publicPath, buffer, sniffed.mime);
    this.logger.log(`Member ${memberId} updated their profile photo (${publicPath})`);
    return publicPath;
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
      this.membersRepository.createSignedProofUrls(
        [...editRows.flatMap((e) => this.proofPathsOf(e)), ...this.currentProofPaths(row)],
        PROOF_URL_TTL_SECONDS
      ),
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

    const edit = await this.membersRepository.findEditById(id);
    if (edit.status !== 'pending') {
      throw new ConflictException('This edit has already been reviewed.');
    }

    let status: 'verified' | 'rejected';
    let itemReviews: MemberEditItemReview[] | null = null;

    if (dto.items) {
      // Per-item review of an array section: accepted items go live, rejected ones are dropped.
      const decisions = this.resolveItemDecisions(edit, dto.items);
      itemReviews = decisions.map((d, index) => ({ index, decision: d.decision, reason: d.reason }));
      status = decisions.some((d) => d.decision !== 'rejected') ? 'verified' : 'rejected';
      if (dto.status && dto.status !== status) {
        throw badRequest(
          'REVIEW_STATUS_MISMATCH',
          `status '${dto.status}' contradicts the item decisions (they result in '${status}'). Omit status when sending items.`
        );
      }
      if (status === 'verified') await this.applyEdit(edit, decisions);
    } else {
      if (!dto.status) {
        throw badRequest('REVIEW_DECISION_REQUIRED', 'Send either status or per-item decisions (items).');
      }
      status = dto.status;
      if (status === 'rejected' && !reviewNote) {
        throw badRequest('REVIEW_REASON_REQUIRED', 'A reason is required when rejecting an edit — it is shown to the member.');
      }
      if (status === 'verified') await this.applyEdit(edit);
    }

    const updated = await this.membersRepository.updateEditDecision(id, {
      status,
      review_note: reviewNote,
      item_reviews: itemReviews as unknown as MemberProfileEditUpdate['item_reviews'],
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

  // Validates the admin's per-item decisions against the pending edit: coverage of every payload
  // index exactly once, a reason where one is required, and proof for approved_verified.
  private resolveItemDecisions(edit: MemberProfileEditRow, items: ReviewMemberEditDto['items']): ItemDecision[] {
    if (!isArraySection(edit.section) || !Array.isArray(edit.payload)) {
      throw badRequest('ITEM_REVIEW_NOT_SUPPORTED', `Per-item review isn't available for ${edit.section} edits — send status instead.`);
    }
    const payload = edit.payload as EditPayloadItem[];
    const decisions = new Array<ItemDecision | undefined>(payload.length).fill(undefined);

    for (const entry of items ?? []) {
      if (entry.index >= payload.length) {
        throw badRequest('ITEM_REVIEW_INDEX_INVALID', `items[].index ${entry.index} is out of range (payload has ${payload.length} items).`);
      }
      if (decisions[entry.index]) {
        throw badRequest('ITEM_REVIEW_INDEX_INVALID', `items[].index ${entry.index} appears more than once.`);
      }
      const reason = entry.reason?.trim() || null;
      if (entry.decision !== 'approved_verified' && !reason) {
        throw badRequest(
          'ITEM_REVIEW_REASON_REQUIRED',
          `A reason is required for '${entry.decision}' (item ${entry.index}) — it is shown to the member.`
        );
      }
      if (entry.decision === 'approved_verified' && !this.itemHasProof(edit, payload[entry.index])) {
        throw badRequest(
          'VERIFIED_REQUIRES_PROOF',
          `Item ${entry.index} has no proof attached, so it can't be approved as verified. Use approved_hygiene instead.`
        );
      }
      decisions[entry.index] = { decision: entry.decision, reason: entry.decision === 'approved_verified' ? null : reason };
    }

    const missing = decisions.flatMap((d, i) => (d ? [] : [i]));
    if (missing.length > 0) {
      throw badRequest('ITEM_REVIEW_INCOMPLETE', `Every item needs a decision. Missing: ${missing.join(', ')}.`);
    }
    return decisions as ItemDecision[];
  }

  // Per-item sections: that item's own proofAttachments. education / work_experiences: the
  // edit-level proof file or link covering the batch.
  private itemHasProof(edit: MemberProfileEditRow, item: EditPayloadItem): boolean {
    if ((PER_ITEM_PROOF_SECTIONS as readonly string[]).includes(edit.section)) return hasItemProof(item);
    return Boolean(edit.proof_file_url || edit.proof_link);
  }

  // Applies an approved edit. headline_bio/contact overwrite columns directly. Array sections
  // rebuild the live list from the payload: accepted items are written (verified iff
  // approved_verified), rejected items fall back to their live version (or are dropped if new),
  // and live items the member left out of the payload are removed. With no explicit decisions
  // (whole-edit approval) every item is accepted and is verified iff it has proof.
  private async applyEdit(edit: MemberProfileEditRow, decisions?: ItemDecision[]): Promise<void> {
    const { member_id: memberId, section, payload } = edit;

    if (section === 'headline_bio') {
      const p = payload as { headline: string; bio: string };
      await this.membersRepository.applyHeadlineBioEdit(memberId, p.headline, p.bio);
      return;
    }

    if (section === 'contact') {
      const p = payload as {
        contactEmail?: string | null;
        workEmail?: string | null;
        contactPhone?: string | null;
        linkedinUrl?: string | null;
        website?: string | null;
      };
      await this.membersRepository.applyContactEdit(memberId, {
        contactEmail: p.contactEmail?.trim() || null,
        workEmail: p.workEmail?.trim() || null,
        contactPhone: p.contactPhone ?? null,
        linkedinUrl: p.linkedinUrl ?? null,
        website: p.website ?? null,
      });
      return;
    }

    const column = SECTION_TO_COLUMN[section as keyof typeof SECTION_TO_COLUMN];
    if (!column || !ARRAY_SECTIONS.includes(section)) throw new BadRequestException(`Unknown edit section: ${section}`);

    const live = await this.membersRepository.findDetailByProfileId(memberId);
    if (!live) throw new NotFoundException('Member profile not found.');
    const liveItems = normalizeLiveSection(section, live[column as keyof MemberProfileDetailRow], true);
    const liveById = new Map(liveItems.map((item) => [item.id as string, item]));

    const submitted = payload as EditPayloadItem[];
    const resolved: ItemDecision[] =
      decisions ??
      submitted.map((item) => ({
        decision: this.itemHasProof(edit, item) ? 'approved_verified' : 'approved_hygiene',
        reason: null,
      }));

    // Nothing accepted: leave the live section exactly as it is (including items the member
    // would have removed).
    if (resolved.every((d) => d.decision === 'rejected')) return;

    let items: EditPayloadItem[] = [];
    for (let i = 0; i < submitted.length; i++) {
      // isVerified / logoUploadPath are never trusted from the payload.
      const { isVerified: _ignored, ...item } = submitted[i];
      const liveMatch = typeof item.id === 'string' ? liveById.get(item.id) : undefined;

      if (resolved[i].decision === 'rejected') {
        if (liveMatch) items.push(liveMatch);
        continue;
      }
      const accepted: EditPayloadItem = {
        ...item,
        id: liveMatch ? (liveMatch.id as string) : randomUUID(),
        isVerified: resolved[i].decision === 'approved_verified',
      };
      items.push(section === 'key_clients' ? await this.publishClientLogo(memberId, accepted) : accepted);
    }

    if (section === 'work_experiences') {
      assertValidWorkHistory(items as unknown as WorkSpan[]);
      items = sortWorkHistoryNewestFirst(items as unknown as (WorkSpan & EditPayloadItem)[]);
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

  // Admin sees the live sections including private proof, so the diff can show what's attached.
  private currentSectionValues(row: MemberProfileDetailRow): AdminMemberEditsDetailDto['current'] {
    return {
      headline_bio: { headline: row.headline, bio: row.bio },
      contact: {
        contactEmail: row.contact_email,
        workEmail: row.work_email,
        contactPhone: row.contact_phone,
        linkedinUrl: row.linkedin_url,
        website: row.website,
      },
      engagements: normalizeLiveSection('engagements', row.engagements, true) as unknown as AdminMemberEditsDetailDto['current']['engagements'],
      education: normalizeLiveSection('education', row.educations, true) as unknown as AdminMemberEditsDetailDto['current']['education'],
      work_experiences: normalizeLiveSection('work_experiences', row.work_experiences, true) as unknown as AdminMemberEditsDetailDto['current']['work_experiences'],
      key_clients: normalizeLiveSection('key_clients', row.key_clients, true) as unknown as AdminMemberEditsDetailDto['current']['key_clients'],
      testimonials: normalizeLiveSection('testimonials', row.testimonials, true) as unknown as AdminMemberEditsDetailDto['current']['testimonials'],
      awards: normalizeLiveSection('awards', row.awards, true) as unknown as AdminMemberEditsDetailDto['current']['awards'],
    };
  }

  // Private proof files attached to live items, so the admin can open them too.
  private currentProofPaths(row: MemberProfileDetailRow): string[] {
    const paths: string[] = [];
    for (const items of [row.engagements, row.testimonials, row.awards, row.key_clients]) {
      for (const item of (Array.isArray(items) ? items : []) as unknown as EditPayloadItem[]) {
        const normalized = normalizeLiveItem('engagements', item, true);
        for (const a of normalized.proofAttachments as ProofAttachmentInput[]) {
          if (a.type === 'file' && typeof a.url === 'string' && a.url) paths.push(a.url);
        }
      }
    }
    return paths;
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
      joinedAt: row.membership_started_at,
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
      itemReviews: row.item_reviews ?? null,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      submittedAt: row.submitted_at,
    };
  }
}
