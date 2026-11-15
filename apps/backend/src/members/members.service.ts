import { computeDueState } from './renewal';
import { randomUUID } from 'node:crypto';
import { AdminAccessService } from '../auth/admin-access.service';
import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { sniffFileType } from '../common/sniff-file-type';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  AdminMemberVerificationDetailDto,
  MemberEditCurrentValues,
  AdminMemberListItemDto,
  MemberDto,
  MemberEditSection,
  MemberListItemDto,
  MyMemberProfileDto,
  UploadResponse,
} from '@shared/member';
import type { SaveMemberSectionResponse } from '@shared/member-verification';
import { CreateUploadDto, MEMBER_UPLOAD_CONTENT_TYPES } from './dto/create-upload.dto';
import { ListMembersQueryDto, MEMBER_LIST_DEFAULT_PAGE_SIZE } from './dto/list-members-query.dto';
import { UpdateAdminMemberDto } from './dto/update-admin-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import {
  ARRAY_SECTIONS,
  SECTION_TO_COLUMN,
  normalizeLiveItem,
  normalizeLiveSection,
  sectionFieldKeys,
  validateAndPrepareEditPayload,
  type SectionItem,
} from './member-sections';
import { applyVerificationRules, isContactChanged, isSectionUnchanged } from './member-verification';
import { assertValidWorkHistory, sortWorkHistoryNewestFirst, type WorkSpan } from '../common/work-history';
import {
  MembersRepository,
  type MemberSelfUpdate,
  type MemberProfileDetailRow,
  type MemberProfileRow,
  type MemberProfileUpdate,
  type ProfileIdentityRow,
} from './members.repository';

interface ProofAttachmentInput {
  type?: unknown;
  url?: unknown;
  label?: unknown;
}

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

// Proof documents/images attached to a profile edit (matches the member-proofs bucket limit).
const MAX_PROOF_BYTES = 10 * 1024 * 1024;
// New (not yet live) files one edit may reference, and how much of each is read to sniff it.
const MAX_NEW_PROOF_FILES_PER_EDIT = 20;
const SNIFF_BYTES = 4100;

type EditPayloadItem = SectionItem;

// Resolved per-item decision used when applying an array-section edit.
@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    private readonly membersRepository: MembersRepository,
    private readonly adminAccess: AdminAccessService
  ) {}

  // Filtering, text search, sorting and paging all happen in one SQL function
  // (member_directory_ids), so a page is always full and nothing grows with the data.
  async list(query: ListMembersQueryDto): Promise<{ items: MemberListItemDto[]; total: number }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? MEMBER_LIST_DEFAULT_PAGE_SIZE;

    const { ids, total } = await this.membersRepository.findDirectoryPageIds(
      {
        q: query.q?.trim() || undefined,
        serviceIds: query.serviceId,
        categoryId: query.categoryId,
        countries: query.country,
        rateMinCents: query.rateMinCents,
        rateMaxCents: query.rateMaxCents,
        sort: query.sort,
      },
      { limit: pageSize, offset: (page - 1) * pageSize }
    );
    if (ids.length === 0) return { items: [], total };
    const rows = await this.membersRepository.findActiveByIdsInOrder(ids);

    const [profilesById, servicesByMember] = await Promise.all([
      this.membersRepository.findProfilesByIds(rows.map((r) => r.profile_id)),
      this.membersRepository.findMemberServicesByMemberIds(rows.map((r) => r.profile_id)),
    ]);

    return { items: rows.map((row) => this.toListDto(row, profilesById, servicesByMember)), total };
  }

  async findPreviewBySlug(slug: string): Promise<MemberListItemDto> {
    const row = await this.membersRepository.findDetailBySlug(slug);
    if (!row) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member profile not found.' });
    const [profiles, services] = await Promise.all([
      this.membersRepository.findProfilesByIds([row.profile_id]),
      this.membersRepository.findMemberServicesByMemberIds([row.profile_id]),
    ]);
    const account = profiles.get(row.profile_id);
    if (row.status !== 'active' || account?.status !== 'active' || account.deleted_at) {
      throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member profile not found.' });
    }
    return this.toListDto(row, profiles, services);
  }

  // One profile view; see record_member_profile_view() (0003_functions.sql) for what counts.
  async recordProfileView(slug: string, viewerId: string | null): Promise<void> {
    // Slugs are short kebab-case; anything else can't match, so skip the round trip.
    if (!/^[a-z0-9-]{1,200}$/.test(slug)) return;
    await this.membersRepository.recordProfileView(slug, viewerId);
  }

  async findMine(user: AuthenticatedUser): Promise<MyMemberProfileDto> {
    const found = (await this.membersRepository.findSlugAndPhotoByProfileIds([user.id])).get(user.id);
    if (!found)
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'You have no member profile yet.',
      });
    return { id: user.id, slug: found.slug };
  }

  async findOneBySlug(slug: string, user: AuthenticatedUser): Promise<MemberDto> {
    const row = await this.membersRepository.findDetailBySlug(slug);
    if (!row) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member profile not found.' });

    // Visible when both the listing and the account are live — a suspended/deleted account is
    // hidden here too, as in the directory and search. The owner, and admins who manage
    // members, still see it.
    if (row.profile_id !== user.id) {
      const account = (await this.membersRepository.findProfilesByIds([row.profile_id])).get(row.profile_id);
      const listed = row.status === 'active' && account?.status === 'active' && !account.deleted_at;
      if (!listed && !(await this.adminAccess.hasFreshPermission(user, 'manageMembers'))) {
        throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member profile not found.' });
      }
    }

    return this.toDetailDto(row, user);
  }

  // Full profile shape for GET :slug and PATCH :id. Private proof (and client emails) only for the
  // owning member and admins; contact details per canSeeContact().
  private async toDetailDto(row: MemberProfileDetailRow, user: AuthenticatedUser): Promise<MemberDto> {
    const isOwner = row.profile_id === user.id;
    const [profilesById, servicesByMember, isMemberAdmin] = await Promise.all([
      this.membersRepository.findProfilesByIds([row.profile_id]),
      this.membersRepository.findMemberServicesByMemberIds([row.profile_id]),
      isOwner ? Promise.resolve(false) : this.adminAccess.hasFreshPermission(user, 'manageMembers'),
    ]);

    const includeProof = isOwner || isMemberAdmin;
    const contactVisible = includeProof || (await this.canSeeContact(row.profile_id, user));

    const dto: MemberDto = {
      ...this.toListDto(row, profilesById, servicesByMember),
      availabilityNotes: row.availability_notes,
      isAvailable: row.is_available,
      // The personal email is no longer collected or shown (2026-11-15); only the work email is.
      contactEmail: null,
      workEmail: contactVisible ? row.work_email : null,
      contactPhone: contactVisible ? row.contact_phone : null,
      linkedinUrl: contactVisible ? row.linkedin_url : null,
      website: row.website,
      workExperiences: normalizeLiveSection(
        'work_experiences',
        row.work_experiences,
        includeProof
      ) as unknown as MemberDto['workExperiences'],
      educations: normalizeLiveSection('education', row.educations, includeProof) as unknown as MemberDto['educations'],
      engagements: normalizeLiveSection(
        'engagements',
        row.engagements,
        includeProof
      ) as unknown as MemberDto['engagements'],
      qualifications: row.qualifications ?? [],
      credentials: row.credentials ?? [],
      testimonials: normalizeLiveSection(
        'testimonials',
        row.testimonials,
        includeProof
      ) as unknown as MemberDto['testimonials'],
      awards: normalizeLiveSection('awards', row.awards, includeProof) as unknown as MemberDto['awards'],
      keyClients: normalizeLiveSection(
        'key_clients',
        row.key_clients,
        includeProof
      ) as unknown as MemberDto['keyClients'],
      // Tells the contact tab "hidden from you" apart from "not provided".
      contactVisible,
      contactVerified: row.contact_verified,
    };
    return dto;
  }

  // Product decision (2026-10-30): a member's email/work email/phone/LinkedIn are shown, besides
  // the owner and member-managing admins, only to active members (the peer network — the
  // app_member_status claim, resolved fresh by SupabaseAuthGuard when absent) and to clients who
  // have sent this member a consultation request (any status). Everyone else gets null.
  private async canSeeContact(memberId: string, user: AuthenticatedUser): Promise<boolean> {
    if (user.role === 'member') return user.memberStatus === 'active';
    if (user.role === 'client') return this.membersRepository.hasConsultationWith(user.id, memberId);
    return false;
  }

  async requestUpload(memberId: string, user: AuthenticatedUser, dto: CreateUploadDto): Promise<UploadResponse> {
    this.assertOwner(memberId, user);

    // The exact shape assertOwnedPath() later accepts — keep the two in step.
    const path = `${memberId}/${Date.now()}-${dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const data = await this.membersRepository.createSignedUploadUrl(path);
    return { uploadUrl: data.signedUrl, path: data.path };
  }

  // PUT :id/sections/:section — the member's edit goes live at once (2026-11-15); an admin verifies
  // afterwards. A payload equal to the live section writes nothing. New items, and items whose key
  // fields changed, are saved unverified; other edits keep the item's tick (member-verification.ts).
  async saveSection(
    memberId: string,
    user: AuthenticatedUser,
    section: MemberEditSection,
    rawPayload: unknown
  ): Promise<SaveMemberSectionResponse> {
    this.assertOwner(memberId, user);
    const payload = validateAndPrepareEditPayload(section, rawPayload);
    this.assertOwnedFilePaths(memberId, payload);
    await this.assertProofFileTypes(memberId, payload);

    const live = await this.membersRepository.findDetailByProfileId(memberId);
    if (!live) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member profile not found.' });

    const changed = await this.writeSection(live, section, payload);
    const current = changed ? ((await this.membersRepository.findDetailByProfileId(memberId)) ?? live) : live;
    return { changed, member: await this.toDetailDto(current, user) };
  }

  // Writes one validated section. Returns false (and writes nothing) when it equals the live value.
  private async writeSection(live: MemberProfileDetailRow, section: MemberEditSection, payload: unknown) {
    const memberId = live.profile_id;

    if (section === 'headline_bio') {
      const p = payload as { headline: string; bio: string };
      if (p.headline === (live.headline ?? '') && p.bio === (live.bio ?? '')) return false;
      await this.membersRepository.applyHeadlineBioEdit(memberId, p.headline, p.bio);
      return true;
    }

    if (section === 'contact') {
      const p = payload as Record<string, string | null | undefined>;
      const clean = (value: string | null | undefined) => value?.trim() || null;
      const next = {
        workEmail: clean(p.workEmail),
        contactPhone: clean(p.contactPhone),
        linkedinUrl: clean(p.linkedinUrl),
        website: clean(p.website),
      };
      const current = {
        workEmail: live.work_email,
        contactPhone: live.contact_phone,
        linkedinUrl: live.linkedin_url,
        website: live.website,
      };
      if (!isContactChanged(current, next)) return false;
      await this.membersRepository.applyContactLive(memberId, next, false);
      return true;
    }

    const column = SECTION_TO_COLUMN[section as keyof typeof SECTION_TO_COLUMN];
    if (!column || !ARRAY_SECTIONS.includes(section)) {
      throw new BadRequestException({
        code: 'MEMBER_EDIT_SECTION_INVALID',
        message: `Unknown edit section: ${section}`,
      });
    }
    const liveItems = normalizeLiveSection(section, live[column as keyof MemberProfileDetailRow], true);
    const submitted = payload as EditPayloadItem[];
    if (isSectionUnchanged(section, sectionFieldKeys(section), liveItems, submitted)) return false;

    const liveById = new Map(liveItems.map((item) => [item.id as string, item]));
    let items: EditPayloadItem[] = [];
    for (const item of applyVerificationRules(section, liveItems, submitted)) {
      const liveMatch = typeof item.id === 'string' ? liveById.get(item.id) : undefined;
      const withId: EditPayloadItem = { ...item, id: liveMatch ? (liveMatch.id as string) : randomUUID() };
      items.push(section === 'key_clients' ? await this.publishClientLogo(memberId, withId, liveMatch) : withId);
    }
    if (section === 'work_experiences') {
      assertValidWorkHistory(items as unknown as WorkSpan[]);
      items = sortWorkHistoryNewestFirst(items as unknown as (WorkSpan & EditPayloadItem)[]);
    }
    await this.membersRepository.applySectionEdit(memberId, column, section, items);

    return true;
  }

  // PATCH :id — availability and/or photo, applied together and immediately (product decision,
  // 2026-10-21: no admin review for these). A new photo sits in the private member-proofs bucket;
  // it's validated by magic bytes and copied to a fresh public path, so caches never serve the
  // old one. Validation runs before anything is written, so a bad photo leaves availability as-is.
  async updateOwnProfile(memberId: string, user: AuthenticatedUser, dto: UpdateMemberDto): Promise<MemberDto> {
    this.assertOwner(memberId, user);
    if (dto.isAvailable === undefined && dto.availabilityNotes === undefined && dto.photoUploadPath === undefined) {
      throw new BadRequestException({
        code: 'NOTHING_TO_UPDATE',
        message: 'Send at least one field to update.',
      });
    }

    const patch: MemberSelfUpdate = {};
    if (dto.isAvailable !== undefined) patch.is_available = dto.isAvailable;
    if (dto.availabilityNotes !== undefined) patch.availability_notes = dto.availabilityNotes?.trim() || null;
    if (dto.photoUploadPath !== undefined)
      patch.photo_path = await this.publishProfilePhoto(memberId, dto.photoUploadPath);

    await this.membersRepository.updateOwnFields(memberId, patch);
    const row = await this.membersRepository.findDetailByProfileId(memberId);
    if (!row) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member profile not found.' });
    return this.toDetailDto(row, user);
  }

  private async publishProfilePhoto(memberId: string, uploadPath: string): Promise<string> {
    this.assertOwnedPath(memberId, uploadPath);
    // Size from storage metadata first, so an oversized object is never pulled into memory.
    if ((await this.membersRepository.findProofFileSize(uploadPath)) > MAX_PHOTO_BYTES) throw this.photoTooLarge();
    const buffer = await this.membersRepository.downloadProofFile(uploadPath);
    const sniffed = await sniffFileType(buffer);
    const ext = sniffed ? PHOTO_MIME_TO_EXT[sniffed.mime] : undefined;
    if (!sniffed || !ext) {
      throw new BadRequestException({
        code: 'PHOTO_INVALID_TYPE',
        message: 'Profile photos must be a JPEG, PNG, or WebP image.',
      });
    }
    if (buffer.length > MAX_PHOTO_BYTES) throw this.photoTooLarge();
    const publicPath = `members/${memberId}/profile-photo-${randomUUID()}.${ext}`;
    await this.membersRepository.uploadPublicAsset(publicPath, buffer, sniffed.mime);
    this.logger.log(`Member ${memberId} updated their profile photo (${publicPath})`);
    return publicPath;
  }

  private photoTooLarge(): BadRequestException {
    return new BadRequestException({ code: 'PHOTO_TOO_LARGE', message: 'Profile photos must be under 5MB.' });
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
      renewalDueState: computeDueState(row.membership_started_at),
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
      renewalDueState: computeDueState(updated.membership_started_at),
    };
  }

  // Everything the verification page needs for one member: the live sections with their proof,
  // and signed links for the private proof files.
  async adminGetVerification(memberId: string): Promise<AdminMemberVerificationDetailDto> {
    const row = await this.membersRepository.findDetailByProfileId(memberId);
    if (!row) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member profile not found.' });
    const [profilesById, fileUrls] = await Promise.all([
      this.membersRepository.findProfilesByIds([memberId]),
      this.membersRepository.createSignedProofUrls(this.currentProofPaths(row), PROOF_URL_TTL_SECONDS),
    ]);
    const profile = profilesById.get(memberId);
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
      contactVerified: row.contact_verified,
      fileUrls,
    };
  }

  // ---------------------------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------------------------

  private assertOwner(memberId: string, user: AuthenticatedUser): void {
    if (user.id !== memberId) {
      throw new ForbiddenException({
        code: 'MEMBER_NOT_OWNER',
        message: 'You can only edit your own member profile.',
      });
    }
  }

  // A newly uploaded key-client logo sits in the private member-proofs bucket as
  // `logoUploadPath`, but the public profile reads `logoUrl`. On approval, copy the file into the
  // public application-assets bucket (magic-byte checked) and point `logoUrl` at it. Items without
  // a new upload keep the logoUrl of the LIVE item they edit (or none for a new item) — a
  // client-supplied logoUrl is never trusted, or a member could point their profile at any URL.
  private async publishClientLogo(
    memberId: string,
    item: EditPayloadItem,
    liveMatch: EditPayloadItem | undefined
  ): Promise<EditPayloadItem> {
    const { logoUploadPath, logoUrl: _clientLogoUrl, ...rest } = item;
    if (typeof logoUploadPath !== 'string' || logoUploadPath.length === 0) {
      return { ...rest, logoUrl: typeof liveMatch?.logoUrl === 'string' ? liveMatch.logoUrl : null };
    }
    this.assertOwnedPath(memberId, logoUploadPath);
    const clientName = typeof rest.name === 'string' ? rest.name : 'a client';
    const logoTooLarge = () =>
      new BadRequestException({
        code: 'LOGO_TOO_LARGE',
        message: `The logo for ${clientName} is larger than 2MB — reject this edit instead.`,
      });

    // Size from storage metadata first, so an oversized object is never pulled into memory.
    if ((await this.membersRepository.findProofFileSize(logoUploadPath)) > MAX_LOGO_BYTES) throw logoTooLarge();
    const buffer = await this.membersRepository.downloadProofFile(logoUploadPath);
    const sniffed = await sniffFileType(buffer);
    const ext = sniffed ? LOGO_MIME_TO_EXT[sniffed.mime] : undefined;
    if (!sniffed || !ext) {
      throw new BadRequestException({
        code: 'LOGO_INVALID_TYPE',
        message: `The logo for ${clientName} isn't a PNG, JPEG, WebP, or GIF image — reject this edit instead.`,
      });
    }
    if (buffer.length > MAX_LOGO_BYTES) throw logoTooLarge();

    const publicPath = `members/${memberId}/client-logos/${randomUUID()}.${ext}`;
    await this.membersRepository.uploadPublicAsset(publicPath, buffer, sniffed.mime);
    this.logger.log(`Published client logo for member ${memberId} at ${publicPath}`);
    return { ...rest, logoUrl: this.membersRepository.buildPhotoUrl(publicPath) };
  }

  // Every private member-proofs object a section payload references.
  private proofPathsOf(payload: unknown): string[] {
    const paths: string[] = [];
    if (Array.isArray(payload)) {
      for (const item of payload as EditPayloadItem[]) {
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
  private assertOwnedFilePaths(memberId: string, payload: unknown): void {
    for (const path of this.proofPathsOf(payload)) this.assertOwnedPath(memberId, path);
  }

  // Signed uploads go straight from the browser to Storage, so the declared Content-Type is the
  // client's word. Before an edit can reference a file (and an admin is handed a link to it),
  // sniff its real type from magic bytes — CLAUDE.md: never trust the declared MIME type.
  private async assertProofFileTypes(memberId: string, payload: unknown): Promise<void> {
    // Only files this edit newly references: the modal re-sends every existing row with its
    // proof, and files already on the live profile were accepted earlier (some before this check
    // existed) — re-checking them would block every future save of the section on one old file.
    const live = await this.membersRepository.findDetailByProfileId(memberId);
    const alreadyLive = new Set(live ? this.currentProofPaths(live) : []);
    const paths = [...new Set(this.proofPathsOf(payload))].filter((path) => !alreadyLive.has(path));
    if (paths.length > MAX_NEW_PROOF_FILES_PER_EDIT) {
      throw new BadRequestException({
        code: 'UPLOAD_LIMIT_EXCEEDED',
        message: `An edit can attach at most ${MAX_NEW_PROOF_FILES_PER_EDIT} new files.`,
      });
    }
    // One file at a time, reading only the header bytes file-type needs — never whole files.
    for (const path of paths) {
      const { head, size } = await this.membersRepository.readProofFileHead(path, SNIFF_BYTES);
      const sniffed = await sniffFileType(head);
      if (!sniffed || !(MEMBER_UPLOAD_CONTENT_TYPES as readonly string[]).includes(sniffed.mime)) {
        throw new BadRequestException({
          code: 'UPLOAD_INVALID_TYPE',
          message: 'Attached files must be a PDF or a JPEG, PNG, WebP or GIF image.',
        });
      }
      if (size > MAX_PROOF_BYTES) {
        throw new BadRequestException({ code: 'UPLOAD_TOO_LARGE', message: 'Attached files must be under 10MB.' });
      }
    }
  }

  // Only the exact shape requestUpload() mints is accepted: `<memberId>/<timestamp>-<safe name>`.
  // Paths reach Storage inside a URL, where encoded dot segments (`%2e%2e/`) or backslashes would be
  // resolved — a prefix check alone let a member point the service-role client at another
  // member's (or another bucket's) private object.
  private assertOwnedPath(memberId: string, path: string): void {
    const ownUpload = new RegExp(`^${memberId}/\\d+-[A-Za-z0-9._-]+$`);
    if (!ownUpload.test(path)) {
      throw new BadRequestException({
        code: 'UPLOAD_NOT_OWNED',
        message: 'Uploaded files must be your own uploads.',
      });
    }
  }

  // Admin sees the live sections including private proof, so the diff can show what's attached.
  private currentSectionValues(row: MemberProfileDetailRow): MemberEditCurrentValues {
    return {
      headline_bio: { headline: row.headline, bio: row.bio },
      contact: {
        workEmail: row.work_email,
        contactPhone: row.contact_phone,
        linkedinUrl: row.linkedin_url,
        website: row.website,
      },
      engagements: normalizeLiveSection(
        'engagements',
        row.engagements,
        true
      ) as unknown as MemberEditCurrentValues['engagements'],
      education: normalizeLiveSection(
        'education',
        row.educations,
        true
      ) as unknown as MemberEditCurrentValues['education'],
      work_experiences: normalizeLiveSection(
        'work_experiences',
        row.work_experiences,
        true
      ) as unknown as MemberEditCurrentValues['work_experiences'],
      key_clients: normalizeLiveSection(
        'key_clients',
        row.key_clients,
        true
      ) as unknown as MemberEditCurrentValues['key_clients'],
      testimonials: normalizeLiveSection(
        'testimonials',
        row.testimonials,
        true
      ) as unknown as MemberEditCurrentValues['testimonials'],
      awards: normalizeLiveSection('awards', row.awards, true) as unknown as MemberEditCurrentValues['awards'],
    };
  }

  // Private proof files attached to live items, so the admin can open them too.
  private currentProofPaths(row: MemberProfileDetailRow): string[] {
    const paths: string[] = [];
    for (const items of [
      row.engagements,
      row.testimonials,
      row.awards,
      row.key_clients,
      row.educations,
      row.work_experiences,
    ]) {
      for (const item of (Array.isArray(items) ? items : []) as unknown as EditPayloadItem[]) {
        const normalized = normalizeLiveItem('engagements', item, true);
        for (const a of normalized.proofAttachments as ProofAttachmentInput[]) {
          if (a.type === 'file' && typeof a.url === 'string' && a.url) paths.push(a.url);
        }
      }
    }
    return paths;
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
}
