import type { ResourceQueryDto } from './dto/resource-query.dto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ProfilesRepository } from '../auth/profiles.repository';
import { randomUUID } from 'node:crypto';
import { fromBuffer as sniffFileType } from 'file-type';
import {
  ResourcesRepository,
  type PerkRow,
  type LearningRow,
  type CollectionRow,
  type TemplatePublicRow,
} from './resources.repository';
import {
  mapPerk,
  mapLearning,
  mapCollection,
  perkInsert,
  perkUpdate,
  learningInsert,
  learningUpdate,
  collectionInsert,
  collectionUpdate,
  mapTemplate,
  templateInsert,
  templateUpdate,
} from './resources.mapping';
import type { Role } from '../auth/types/auth.types';
import type {
  PerkDto,
  LearningDto,
  CollectionDto,
  CreatePerkRequest,
  UpdatePerkRequest,
  CreateLearningRequest,
  UpdateLearningRequest,
  CreateCollectionRequest,
  UpdateCollectionRequest,
  TemplateDto,
  TemplateDownloadDto,
  TemplateUploadDto,
  TemplateFileType,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '@shared/resource';

// Template files: what an admin may upload, keyed by the MIME type sniffed from the bytes
// (never the client's Content-Type or file extension).
const TEMPLATE_MIME: Record<string, TemplateFileType> = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/pdf': 'pdf',
};
const TEMPLATE_MAX_BYTES = 15 * 1024 * 1024;
// Long enough to start a download, short enough that a copied link is useless soon after.
const TEMPLATE_LINK_SECONDS = 60;

@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name);
  constructor(
    private readonly repository: ResourcesRepository,
    private readonly profiles: ProfilesRepository,
  ) {}

  private filter<
    T extends {
      title?: string;
      name?: string;
      description?: string;
      summary?: string;
      category?: string;
      audiences?: string[];
      level?: string;
      isFeatured?: boolean;
      kind?: string;
    },
  >(items: T[], query: ResourceQueryDto): T[] {
    return items.filter(
      (i) =>
        (!query.q ||
          `${i.title ?? i.name} ${i.summary ?? i.description ?? ''}`
            .toLowerCase()
            .includes(query.q.toLowerCase())) &&
        (!query.category || i.category === query.category) &&
        (!query.audience ||
          !i.audiences?.length ||
          i.audiences.includes(query.audience)) &&
        (!query.level || i.level === query.level) &&
        (!query.kind || i.kind === query.kind) &&
        (query.featured === undefined ||
          i.isFeatured === (query.featured === 'true')),
    );
  }
  private asset(value: string | null): string | null {
    if (!value || value.startsWith('https://')) return value;
    return `${process.env.SUPABASE_URL}/storage/v1/object/public/resource-assets/${value}`;
  }
  private perk(row: PerkRow, role?: Role): PerkDto {
    const member = role === 'member' || role === 'admin';
    const expired =
      !!row.offer_expires_at &&
      row.offer_expires_at < new Date().toISOString().slice(0, 10);
    const lockReason =
      row.offer_status !== 'live'
        ? 'coming_soon'
        : expired
          ? 'expired'
          : !role
            ? 'sign_in'
            : null;
    // Members get the member tier, falling back to the client tier when a perk has no member
    // offer, so a member never sees less than a client. Clients only ever get the client tier.
    const useMemberTier = member && !!row.member_offer;
    const offer = useMemberTier ? row.member_offer : row.user_offer;
    const code = useMemberTier ? row.member_coupon_code : row.user_coupon_code;
    const url = useMemberTier ? row.member_offer_url : row.user_offer_url;
    const available = !lockReason && !!offer && !!(code || url);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      category: row.category as PerkDto['category'],
      tagline: row.tagline,
      description: row.description,
      products: row.products,
      websiteUrl: row.website_url,
      logoUrl: this.asset(row.logo_url),
      coverImageUrl: this.asset(row.cover_image_url),
      offerStatus: row.offer_status as PerkDto['offerStatus'],
      isFeatured: row.is_featured,
      sortOrder: row.sort_order,
      offer: available ? offer : null,
      couponCode: available ? code : null,
      offerUrl: available ? url : null,
      offerTerms: available ? row.offer_terms : null,
      offerExpiresAt: available ? row.offer_expires_at : null,
      canRedeem: available,
      lockReason: lockReason || (available ? null : 'unavailable'),
    };
  }
  private learning(
    row: LearningRow,
    role: Role | undefined,
    freeIds: Set<string>,
  ): LearningDto {
    const member = role === 'member' || role === 'admin';
    const open =
      row.access === 'open' || (row.access === 'auto' && freeIds.has(row.id));
    const canWatch = !!role && (member || open);
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      thumbnailUrl: this.asset(row.thumbnail_url),
      channel: row.channel,
      durationMinutes: row.duration_minutes,
      category: row.category as LearningDto['category'],
      level: row.level as LearningDto['level'],
      audiences: row.audiences as LearningDto['audiences'],
      isFeatured: row.is_featured,
      sortOrder: row.sort_order,
      videoProvider: row.video_provider as LearningDto['videoProvider'],
      videoUrl: canWatch ? row.video_url : null,
      canWatch,
      lockReason: canWatch ? null : role ? 'membership' : 'sign_in',
    };
  }
  // Every template is members-only: metadata for everyone, the file only via downloadTemplate().
  private template(row: TemplatePublicRow, role?: Role): TemplateDto {
    const member = role === 'member' || role === 'admin';
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      category: row.category as TemplateDto['category'],
      highlights: row.highlights,
      fileType: row.file_type as TemplateDto['fileType'],
      fileName: row.file_name,
      fileSizeBytes: row.file_size_bytes,
      previewImageUrl: this.asset(row.preview_image_url),
      audiences: row.audiences as TemplateDto['audiences'],
      isFeatured: row.is_featured,
      sortOrder: row.sort_order,
      canDownload: member,
      lockReason: member ? null : role ? 'membership' : 'sign_in',
    };
  }
  private freeIds(collections: CollectionRow[]): Set<string> {
    return new Set(
      collections
        .filter(
          (c) =>
            c.is_active && c.kind === 'learning_playlist' && c.item_ids.length,
        )
        .map((c) => c.item_ids[0]),
    );
  }
  async listPerks(
    role?: Role,
    query: ResourceQueryDto = {},
  ): Promise<PerkDto[]> {
    return this.filter(
      (await this.repository.listPerks())
        .filter((r) => r.is_active)
        .map((r) => this.perk(r, role)),
      query,
    );
  }
  async getPerk(slug: string, role?: Role): Promise<PerkDto> {
    const item = (await this.listPerks(role)).find((r) => r.slug === slug);
    if (!item) throw new NotFoundException('Perk not found.');
    return item;
  }
  async listLearnings(
    role?: Role,
    query: ResourceQueryDto = {},
  ): Promise<LearningDto[]> {
    const [rows, collections] = await Promise.all([
      this.repository.listLearnings(),
      this.repository.listCollections(),
    ]);
    const free = this.freeIds(collections);
    return this.filter(
      rows.filter((r) => r.is_active).map((r) => this.learning(r, role, free)),
      query,
    );
  }
  async getLearning(id: string, role?: Role): Promise<LearningDto> {
    const item = (await this.listLearnings(role)).find((r) => r.id === id);
    if (!item) throw new NotFoundException('Learning not found.');
    return item;
  }
  async listCollections(
    role?: Role,
    query: ResourceQueryDto = {},
  ): Promise<CollectionDto[]> {
    const [collections, perks, learnings, templates] = await Promise.all([
      this.repository.listCollections(),
      this.repository.listPerks(),
      this.repository.listLearnings(),
      this.repository.listTemplates(),
    ]);
    const free = this.freeIds(collections);
    return this.filter(
      collections
        .filter((c) => c.is_active)
        .map((c) => {
          const source =
            c.kind === 'perk_stack'
              ? perks.filter((p) => p.is_active).map((p) => this.perk(p, role))
              : c.kind === 'template_kit'
                ? templates.map((t) => this.template(t, role))
                : learnings
                    .filter((l) => l.is_active)
                    .map((l) => this.learning(l, role, free));
          const byId = new Map<string, PerkDto | LearningDto | TemplateDto>(
            source.map((item) => [item.id, item]),
          );
          const items = c.item_ids.flatMap((id) =>
            byId.has(id) ? [byId.get(id)!] : [],
          );
          return {
            id: c.id,
            kind: c.kind as CollectionDto['kind'],
            slug: c.slug,
            title: c.title,
            description: c.description,
            audiences: c.audiences as CollectionDto['audiences'],
            coverImageUrl: this.asset(c.cover_image_url),
            sortOrder: c.sort_order,
            itemIds: items.map((i) => i.id),
            items,
          };
        }),
      query,
    );
  }
  async getCollection(id: string, role?: Role): Promise<CollectionDto> {
    const item = (await this.listCollections(role)).find((c) => c.id === id);
    if (!item) throw new NotFoundException('Collection not found.');
    return item;
  }
  async adminPerks() {
    return (await this.repository.listPerks()).map(mapPerk);
  }
  async adminLearnings() {
    return (await this.repository.listLearnings()).map(mapLearning);
  }
  async adminCollections() {
    return (await this.repository.listCollections()).map(mapCollection);
  }
  async adminPerk(id: string) {
    const item = (await this.adminPerks()).find((i) => i.id === id);
    if (!item) throw new NotFoundException('Perk not found.');
    return item;
  }
  async adminLearning(id: string) {
    const item = (await this.adminLearnings()).find((i) => i.id === id);
    if (!item) throw new NotFoundException('Learning not found.');
    return item;
  }
  async adminCollection(id: string) {
    const item = (await this.adminCollections()).find((i) => i.id === id);
    if (!item) throw new NotFoundException('Collection not found.');
    return item;
  }
  private validatePerk(dto: CreatePerkRequest) {
    for (const [offer, code, url] of [
      [dto.userOffer, dto.userCouponCode, dto.userOfferUrl],
      [dto.memberOffer, dto.memberCouponCode, dto.memberOfferUrl],
    ]) {
      if (offer != null && (!offer.trim() || !(code?.trim() || url)))
        throw new BadRequestException(
          'Offer text requires a non-empty coupon code or HTTPS redemption URL.',
        );
      if (!offer && (code || url))
        throw new BadRequestException(
          'A redemption code or URL requires offer text.',
        );
    }
    if (dto.offerStatus === 'live' && !(dto.userOffer || dto.memberOffer))
      throw new BadRequestException(
        'A live perk requires a redeemable offer for at least one tier.',
      );
  }
  private validateLearning(dto: CreateLearningRequest) {
    const url = new URL(dto.videoUrl);
    if (
      (dto.videoProvider ?? 'youtube') === 'youtube' &&
      ![
        'www.youtube.com',
        'youtube.com',
        'youtu.be',
        'www.youtube-nocookie.com',
      ].includes(url.hostname)
    )
      throw new BadRequestException('YouTube videos require a YouTube URL.');
    if ((dto.videoProvider ?? 'youtube') === 'youtube') {
      const id =
        url.hostname === 'youtu.be'
          ? url.pathname.slice(1)
          : url.pathname === '/watch'
            ? url.searchParams.get('v')
            : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
      if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id))
        throw new BadRequestException('A valid YouTube video ID is required.');
    }
    // Thumbnails must be our own copies; third-party thumbnail URLs can disclose locked video IDs.
    if (dto.thumbnailUrl?.startsWith('https://')) {
      const root = `${process.env.SUPABASE_URL}/storage/v1/object/public/resource-assets/`;
      if (!dto.thumbnailUrl.startsWith(root))
        throw new BadRequestException(
          'Thumbnails must use the resource-assets bucket.',
        );
    }
  }
  private async validateCollection(dto: CreateCollectionRequest) {
    const ids = dto.itemIds ?? [];
    const source =
      dto.kind === 'perk_stack'
        ? await this.repository.listPerks()
        : dto.kind === 'template_kit'
          ? await this.repository.listTemplatesForAdmin()
          : await this.repository.listLearnings();
    const valid = new Set(source.map((r) => r.id));
    if (ids.some((id) => !valid.has(id)))
      throw new BadRequestException(
        'Collection contains an unknown item or an item of the wrong resource kind.',
      );
  }
  async createPerk(dto: CreatePerkRequest) {
    this.validatePerk(dto);
    const row = await this.repository.createPerk(
      perkInsert(dto, await this.repository.perkSlug(dto.name)),
    );
    if (!row) throw new NotFoundException();
    return mapPerk(row);
  }
  async updatePerk(id: string, dto: UpdatePerkRequest) {
    if (!Object.keys(dto).length)
      throw new BadRequestException('At least one field is required.');
    const current = await this.adminPerk(id);
    this.validatePerk({ ...current, ...dto });
    const row = await this.repository.updatePerk(id, perkUpdate(dto));
    if (!row) throw new NotFoundException();
    return mapPerk(row);
  }
  async deletePerk(id: string) {
    await this.adminPerk(id);
    await this.repository.deletePerk(id);
  }
  async createLearning(dto: CreateLearningRequest) {
    this.validateLearning(dto);
    const row = await this.repository.createLearning(learningInsert(dto));
    if (!row) throw new NotFoundException();
    return mapLearning(row);
  }
  async updateLearning(id: string, dto: UpdateLearningRequest) {
    if (!Object.keys(dto).length)
      throw new BadRequestException('At least one field is required.');
    const current = await this.adminLearning(id);
    this.validateLearning({ ...current, ...dto });
    const row = await this.repository.updateLearning(id, learningUpdate(dto));
    if (!row) throw new NotFoundException();
    return mapLearning(row);
  }
  async deleteLearning(id: string) {
    await this.adminLearning(id);
    await this.repository.deleteLearning(id);
  }
  async createCollection(dto: CreateCollectionRequest) {
    await this.validateCollection(dto);
    const row = await this.repository.createCollection(
      collectionInsert(dto, await this.repository.collectionSlug(dto.title)),
    );
    if (!row) throw new NotFoundException();
    return mapCollection(row);
  }
  async updateCollection(id: string, dto: UpdateCollectionRequest) {
    if (!Object.keys(dto).length)
      throw new BadRequestException('At least one field is required.');
    const current = await this.adminCollection(id);
    if (dto.kind && dto.kind !== current.kind)
      throw new BadRequestException('Collection kind cannot be changed.');
    await this.validateCollection({ ...current, ...dto });
    const row = await this.repository.updateCollection(
      id,
      collectionUpdate(dto),
    );
    if (!row) throw new NotFoundException();
    return mapCollection(row);
  }
  async deleteCollection(id: string) {
    await this.adminCollection(id);
    await this.repository.deleteCollection(id);
  }

  // ── Templates ────────────────────────────────────────────────────────────
  async listTemplates(role?: Role, query: ResourceQueryDto = {}): Promise<TemplateDto[]> {
    return this.filter(
      (await this.repository.listTemplates()).map((t) => this.template(t, role)),
      query,
    );
  }
  async getTemplate(id: string, role?: Role): Promise<TemplateDto> {
    const item = (await this.listTemplates(role)).find((t) => t.id === id);
    if (!item) throw new NotFoundException('Template not found.');
    return item;
  }
  // The controller's @Roles('member') reads the role from the JWT, which can lag a membership
  // change by up to the token's lifetime. A download hands out the paid file itself, so the role
  // is re-confirmed from the database here (same posture as admin routes).
  async downloadTemplate(id: string, userId: string): Promise<TemplateDownloadDto> {
    const profile = await this.profiles.findById(userId);
    if (
      !profile ||
      profile.status !== 'active' ||
      (profile.role !== 'member' && profile.role !== 'admin')
    )
      throw new ForbiddenException('Template downloads are available to members only.');
    const file = await this.repository.findActiveTemplateFile(id);
    if (!file) throw new NotFoundException('Template not found.');
    const url = await this.repository.signTemplateFile(
      file.file_path,
      file.file_name,
      TEMPLATE_LINK_SECONDS,
    );
    return {
      url,
      fileName: file.file_name,
      expiresAt: new Date(Date.now() + TEMPLATE_LINK_SECONDS * 1000).toISOString(),
    };
  }
  async adminTemplates() {
    return (await this.repository.listTemplatesForAdmin()).map(mapTemplate);
  }
  async adminTemplate(id: string) {
    const item = (await this.adminTemplates()).find((i) => i.id === id);
    if (!item) throw new NotFoundException('Template not found.');
    return item;
  }
  async uploadTemplate(file: {
    buffer: Buffer;
    size: number;
    originalname: string;
  }): Promise<TemplateUploadDto> {
    if (file.size === 0) throw new BadRequestException('Uploaded file is empty.');
    if (file.size > TEMPLATE_MAX_BYTES)
      throw new BadRequestException('File too large — max 15MB.');
    const sniffed = await sniffFileType(file.buffer);
    const fileType = sniffed ? TEMPLATE_MIME[sniffed.mime] : undefined;
    if (!sniffed || !fileType)
      throw new BadRequestException('Only Word, Excel, PowerPoint or PDF files are accepted.');
    const filePath = `uploads/${randomUUID()}.${fileType}`;
    await this.repository.uploadTemplateFile(filePath, file.buffer, sniffed.mime);
    // Keep the admin's file name for the download, minus any path and with the true extension.
    const base = (file.originalname.split(/[\\/]/).pop() ?? '')
      .replace(/\.[^.]*$/, '')
      .replace(/[^\w .()&-]+/g, '')
      .trim()
      .slice(0, 150);
    return {
      filePath,
      fileName: `${base || 'template'}.${fileType}`,
      fileSizeBytes: file.size,
      fileType,
    };
  }
  private async assertTemplateFile(dto: Pick<CreateTemplateRequest, 'filePath' | 'fileType'>) {
    if (!dto.filePath.endsWith(`.${dto.fileType}`))
      throw new BadRequestException('fileType does not match the uploaded file.');
    if (!(await this.repository.templateFileExists(dto.filePath)))
      throw new BadRequestException('Upload the file first (POST /v1/admin/templates/upload).');
  }
  // Best-effort: an admin-uploaded file no template points at any more. Seed files (starter/)
  // are left alone so a database rebuild never needs them re-uploaded.
  private async removeOrphanedFile(path: string) {
    if (!path.startsWith('uploads/')) return;
    const stillUsed = (await this.repository.listTemplatesForAdmin()).some((t) => t.file_path === path);
    if (stillUsed) return;
    try {
      await this.repository.removeTemplateFile(path);
    } catch (error) {
      this.logger.warn(`Could not remove orphaned template file ${path}: ${String(error)}`);
    }
  }
  async createTemplate(dto: CreateTemplateRequest) {
    await this.assertTemplateFile(dto);
    const row = await this.repository.createTemplate(
      templateInsert(dto, await this.repository.templateSlug(dto.title)),
    );
    if (!row) throw new NotFoundException();
    return mapTemplate(row);
  }
  async updateTemplate(id: string, dto: UpdateTemplateRequest) {
    if (!Object.keys(dto).length)
      throw new BadRequestException('At least one field is required.');
    const current = await this.adminTemplate(id);
    if (dto.filePath !== undefined || dto.fileType !== undefined)
      await this.assertTemplateFile({ ...current, ...dto });
    const row = await this.repository.updateTemplate(id, templateUpdate(dto));
    if (!row) throw new NotFoundException();
    if (dto.filePath !== undefined && dto.filePath !== current.filePath)
      await this.removeOrphanedFile(current.filePath);
    return mapTemplate(row);
  }
  async deleteTemplate(id: string) {
    const current = await this.adminTemplate(id);
    await this.repository.deleteTemplate(id);
    await this.removeOrphanedFile(current.filePath);
  }
}
