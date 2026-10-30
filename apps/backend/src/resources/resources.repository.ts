import { generateUniqueSlug, isSlugUniqueViolation, SlugTakenException } from '../common/slugify';
import { Injectable, InternalServerErrorException, ConflictException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';
export type PerkRow = Database['public']['Tables']['perks']['Row'];
export type LearningRow = Database['public']['Tables']['learnings']['Row'];
export type CollectionRow = Database['public']['Tables']['collections']['Row'];
export type TemplateRow = Database['public']['Tables']['templates']['Row'];
// Public reads never select file_path: the private object path only exists server-side for
// minting a signed download link, and in admin reads.
export type TemplatePublicRow = Omit<TemplateRow, 'file_path'>;
function check(error: { code?: string; message?: string; details?: string } | null) {
  if (!error) return;
  // A slug race on insert: SlugTakenException (same 409 body) so callers can regenerate and retry.
  if (isSlugUniqueViolation(error))
    throw new SlugTakenException('RESOURCE_SLUG_TAKEN', 'Resource slug already exists.');
  if (error.code === '23505')
    throw new ConflictException({ code: 'RESOURCE_SLUG_TAKEN', message: 'Resource slug already exists.' });
  if (['23514', '23502', '22P02', '23503'].includes(error.code || ''))
    throw new BadRequestException({ code: 'RESOURCE_INVALID', message: 'Invalid resource data.' });
  throw new InternalServerErrorException('Resource operation failed.');
}
const PERK_COLUMNS = [
  'id',
  'slug',
  'name',
  'category',
  'tagline',
  'description',
  'products',
  'website_url',
  'logo_url',
  'cover_image_url',
  'offer_status',
  'user_offer',
  'user_coupon_code',
  'user_offer_url',
  'member_offer',
  'member_coupon_code',
  'member_offer_url',
  'offer_terms',
  'offer_expires_at',
  'is_featured',
  'sort_order',
  'is_active',
  'created_at',
  'updated_at',
].join(',');
const LEARNING_COLUMNS = [
  'id',
  'title',
  'summary',
  'video_provider',
  'video_url',
  'thumbnail_url',
  'channel',
  'duration_minutes',
  'category',
  'level',
  'audiences',
  'access',
  'is_featured',
  'sort_order',
  'is_active',
  'created_at',
  'updated_at',
].join(',');
const COLLECTION_COLUMNS = [
  'id',
  'kind',
  'slug',
  'title',
  'description',
  'audiences',
  'item_ids',
  'cover_image_url',
  'sort_order',
  'is_active',
  'created_at',
  'updated_at',
].join(',');

const TEMPLATE_PUBLIC_COLUMN_LIST = [
  'id',
  'slug',
  'title',
  'description',
  'category',
  'highlights',
  'file_type',
  'file_name',
  'file_size_bytes',
  'preview_image_url',
  'audiences',
  'is_featured',
  'sort_order',
  'is_active',
  'created_at',
  'updated_at',
];
const TEMPLATE_PUBLIC_COLUMNS = TEMPLATE_PUBLIC_COLUMN_LIST.join(',');
const TEMPLATE_ADMIN_COLUMNS = [...TEMPLATE_PUBLIC_COLUMN_LIST, 'file_path'].join(',');
const TEMPLATE_BUCKET = 'template-files';
@Injectable()
export class ResourcesRepository {
  constructor(private readonly supabase: SupabaseService) {}
  async perkSlug(name: string) {
    return generateUniqueSlug(this.supabase.db, 'perks', name, 'perk');
  }
  async templateSlug(title: string) {
    return generateUniqueSlug(this.supabase.db, 'templates', title, 'template');
  }
  async collectionSlug(title: string) {
    return generateUniqueSlug(this.supabase.db, 'collections', title, 'collection');
  }
  private perks() {
    return this.supabase.db.from('perks');
  }
  async listPerks(): Promise<PerkRow[]> {
    const { data, error } = await this.perks().select(PERK_COLUMNS).order('sort_order').order('id');
    check(error);
    return (data ?? []) as unknown as PerkRow[];
  }
  // Single-row public reads: same rows the lists would yield, without loading the whole table.
  async findActivePerkBySlug(slug: string): Promise<PerkRow | null> {
    const { data, error } = await this.perks()
      .select(PERK_COLUMNS)
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    check(error);
    return data as unknown as PerkRow | null;
  }
  async findActivePerksByIds(ids: string[]): Promise<PerkRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.perks().select(PERK_COLUMNS).in('id', ids).eq('is_active', true);
    check(error);
    return (data ?? []) as unknown as PerkRow[];
  }
  async createPerk(body: Database['public']['Tables']['perks']['Insert']): Promise<PerkRow | null> {
    const { data, error } = await this.perks().insert(body).select(PERK_COLUMNS).maybeSingle();
    check(error);
    return data as unknown as PerkRow | null;
  }
  async updatePerk(id: string, body: Database['public']['Tables']['perks']['Update']): Promise<PerkRow | null> {
    const { data, error } = await this.perks().update(body).eq('id', id).select(PERK_COLUMNS).maybeSingle();
    check(error);
    return data as unknown as PerkRow | null;
  }
  async deletePerk(id: string): Promise<void> {
    const { error } = await this.perks().delete().eq('id', id);
    check(error);
  }
  private learnings() {
    return this.supabase.db.from('learnings');
  }
  async listLearnings(): Promise<LearningRow[]> {
    const { data, error } = await this.learnings().select(LEARNING_COLUMNS).order('sort_order').order('id');
    check(error);
    return (data ?? []) as unknown as LearningRow[];
  }
  async findActiveLearningById(id: string): Promise<LearningRow | null> {
    const { data, error } = await this.learnings()
      .select(LEARNING_COLUMNS)
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    check(error);
    return data as unknown as LearningRow | null;
  }
  async findActiveLearningsByIds(ids: string[]): Promise<LearningRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.learnings().select(LEARNING_COLUMNS).in('id', ids).eq('is_active', true);
    check(error);
    return (data ?? []) as unknown as LearningRow[];
  }
  async createLearning(body: Database['public']['Tables']['learnings']['Insert']): Promise<LearningRow | null> {
    const { data, error } = await this.learnings().insert(body).select(LEARNING_COLUMNS).maybeSingle();
    check(error);
    return data as unknown as LearningRow | null;
  }
  async updateLearning(
    id: string,
    body: Database['public']['Tables']['learnings']['Update']
  ): Promise<LearningRow | null> {
    const { data, error } = await this.learnings().update(body).eq('id', id).select(LEARNING_COLUMNS).maybeSingle();
    check(error);
    return data as unknown as LearningRow | null;
  }
  async deleteLearning(id: string): Promise<void> {
    const { error } = await this.learnings().delete().eq('id', id);
    check(error);
  }
  private collections() {
    return this.supabase.db.from('collections');
  }
  async listCollections(): Promise<CollectionRow[]> {
    const { data, error } = await this.collections().select(COLLECTION_COLUMNS).order('sort_order').order('id');
    check(error);
    return (data ?? []) as unknown as CollectionRow[];
  }
  async findActiveCollectionById(id: string): Promise<CollectionRow | null> {
    const { data, error } = await this.collections()
      .select(COLLECTION_COLUMNS)
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    check(error);
    return data as unknown as CollectionRow | null;
  }
  // Only what decides which learnings are free (the first item of each active playlist).
  async listActivePlaylistItemIds(): Promise<Pick<CollectionRow, 'kind' | 'is_active' | 'item_ids'>[]> {
    const { data, error } = await this.collections()
      .select('kind,is_active,item_ids')
      .eq('kind', 'learning_playlist')
      .eq('is_active', true);
    check(error);
    return (data ?? []) as unknown as Pick<CollectionRow, 'kind' | 'is_active' | 'item_ids'>[];
  }
  async createCollection(body: Database['public']['Tables']['collections']['Insert']): Promise<CollectionRow | null> {
    const { data, error } = await this.collections().insert(body).select(COLLECTION_COLUMNS).maybeSingle();
    check(error);
    return data as unknown as CollectionRow | null;
  }
  async updateCollection(
    id: string,
    body: Database['public']['Tables']['collections']['Update']
  ): Promise<CollectionRow | null> {
    const { data, error } = await this.collections().update(body).eq('id', id).select(COLLECTION_COLUMNS).maybeSingle();
    check(error);
    return data as unknown as CollectionRow | null;
  }
  async deleteCollection(id: string): Promise<void> {
    const { error } = await this.collections().delete().eq('id', id);
    check(error);
  }
  private templates() {
    return this.supabase.db.from('templates');
  }

  private memberProfiles() {
    return this.supabase.db.from('member_profiles');
  }

  // member_profiles.status for a member, or null when they have no member profile.
  async findMemberStatus(profileId: string): Promise<'active' | 'deactivated' | null> {
    const { data, error } = await this.memberProfiles().select('status').eq('profile_id', profileId).maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to check membership.');
    return (data?.status as 'active' | 'deactivated' | undefined) ?? null;
  }
  async listTemplates(): Promise<TemplatePublicRow[]> {
    const { data, error } = await this.templates()
      .select(TEMPLATE_PUBLIC_COLUMNS)
      .eq('is_active', true)
      .order('sort_order')
      .order('id');
    check(error);
    return (data ?? []) as unknown as TemplatePublicRow[];
  }
  async findActiveTemplateById(id: string): Promise<TemplatePublicRow | null> {
    const { data, error } = await this.templates()
      .select(TEMPLATE_PUBLIC_COLUMNS)
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    check(error);
    return data as unknown as TemplatePublicRow | null;
  }
  async findActiveTemplatesByIds(ids: string[]): Promise<TemplatePublicRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.templates().select(TEMPLATE_PUBLIC_COLUMNS).in('id', ids).eq('is_active', true);
    check(error);
    return (data ?? []) as unknown as TemplatePublicRow[];
  }
  async listTemplatesForAdmin(): Promise<TemplateRow[]> {
    const { data, error } = await this.templates().select(TEMPLATE_ADMIN_COLUMNS).order('sort_order').order('id');
    check(error);
    return (data ?? []) as unknown as TemplateRow[];
  }
  // Only the fields needed to mint a download link, for one active template.
  async findActiveTemplateFile(id: string): Promise<{ file_path: string; file_name: string } | null> {
    const { data, error } = await this.templates()
      .select('file_path,file_name')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();
    check(error);
    return data as { file_path: string; file_name: string } | null;
  }
  async createTemplate(body: Database['public']['Tables']['templates']['Insert']): Promise<TemplateRow | null> {
    const { data, error } = await this.templates().insert(body).select(TEMPLATE_ADMIN_COLUMNS).maybeSingle();
    check(error);
    return data as unknown as TemplateRow | null;
  }
  async updateTemplate(
    id: string,
    body: Database['public']['Tables']['templates']['Update']
  ): Promise<TemplateRow | null> {
    const { data, error } = await this.templates()
      .update(body)
      .eq('id', id)
      .select(TEMPLATE_ADMIN_COLUMNS)
      .maybeSingle();
    check(error);
    return data as unknown as TemplateRow | null;
  }
  async deleteTemplate(id: string): Promise<void> {
    const { error } = await this.templates().delete().eq('id', id);
    check(error);
  }
  async uploadTemplateFile(path: string, body: Buffer, contentType: string): Promise<void> {
    const { error } = await this.supabase.db.storage
      .from(TEMPLATE_BUCKET)
      .upload(path, body, { contentType, upsert: false });
    if (error) throw new InternalServerErrorException('Failed to store template file.');
  }
  async templateFileExists(path: string): Promise<boolean> {
    const slash = path.lastIndexOf('/');
    const { data, error } = await this.supabase.db.storage
      .from(TEMPLATE_BUCKET)
      .list(path.slice(0, slash), { search: path.slice(slash + 1), limit: 1 });
    if (error) throw new InternalServerErrorException('Failed to check template file.');
    return (data ?? []).some((o) => o.name === path.slice(slash + 1));
  }
  // Short-lived, single-object link; `download` sets Content-Disposition to the given name.
  async signTemplateFile(path: string, fileName: string, expiresInSeconds: number): Promise<string> {
    const { data, error } = await this.supabase.db.storage
      .from(TEMPLATE_BUCKET)
      .createSignedUrl(path, expiresInSeconds, { download: fileName });
    if (error || !data?.signedUrl) throw new InternalServerErrorException('Failed to prepare the download.');
    return data.signedUrl;
  }
  async removeTemplateFile(path: string): Promise<void> {
    const { error } = await this.supabase.db.storage.from(TEMPLATE_BUCKET).remove([path]);
    if (error) throw new InternalServerErrorException('Failed to remove template file.');
  }
}
