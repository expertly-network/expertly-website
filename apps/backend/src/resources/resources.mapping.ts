import type {
  PerkRow,
  LearningRow,
  CollectionRow,
} from './resources.repository';
import type {
  AdminPerkDto,
  AdminLearningDto,
  AdminCollectionDto,
} from '@shared/resource';
export function mapPerk(row: PerkRow): AdminPerkDto {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slug: row.slug,
    name: row.name,
    category: row.category as AdminPerkDto['category'],
    tagline: row.tagline,
    description: row.description,
    products: row.products,
    websiteUrl: row.website_url,
    logoUrl: row.logo_url,
    coverImageUrl: row.cover_image_url,
    offerStatus: row.offer_status as AdminPerkDto['offerStatus'],
    userOffer: row.user_offer,
    userCouponCode: row.user_coupon_code,
    userOfferUrl: row.user_offer_url,
    memberOffer: row.member_offer,
    memberCouponCode: row.member_coupon_code,
    memberOfferUrl: row.member_offer_url,
    offerTerms: row.offer_terms,
    offerExpiresAt: row.offer_expires_at,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}
export function perkInsert(
  dto: import('@shared/resource').CreatePerkRequest,
  slug: string,
): import('../supabase/database.types').Database['public']['Tables']['perks']['Insert'] {
  return {
    slug,
    name: dto.name,
    category: dto.category,
    tagline: dto.tagline,
    description: dto.description,
    products: dto.products,
    website_url: dto.websiteUrl,
    logo_url: dto.logoUrl,
    cover_image_url: dto.coverImageUrl,
    offer_status: dto.offerStatus,
    user_offer: dto.userOffer,
    user_coupon_code: dto.userCouponCode,
    user_offer_url: dto.userOfferUrl,
    member_offer: dto.memberOffer,
    member_coupon_code: dto.memberCouponCode,
    member_offer_url: dto.memberOfferUrl,
    offer_terms: dto.offerTerms,
    offer_expires_at: dto.offerExpiresAt,
    is_featured: dto.isFeatured,
    sort_order: dto.sortOrder,
    is_active: dto.isActive,
  };
}
export function perkUpdate(
  dto: import('@shared/resource').UpdatePerkRequest,
): import('../supabase/database.types').Database['public']['Tables']['perks']['Update'] {
  return {
    ...(dto.name !== undefined ? { name: dto.name } : {}),
    ...(dto.category !== undefined ? { category: dto.category } : {}),
    ...(dto.tagline !== undefined ? { tagline: dto.tagline } : {}),
    ...(dto.description !== undefined ? { description: dto.description } : {}),
    ...(dto.products !== undefined ? { products: dto.products } : {}),
    ...(dto.websiteUrl !== undefined ? { website_url: dto.websiteUrl } : {}),
    ...(dto.logoUrl !== undefined ? { logo_url: dto.logoUrl } : {}),
    ...(dto.coverImageUrl !== undefined
      ? { cover_image_url: dto.coverImageUrl }
      : {}),
    ...(dto.offerStatus !== undefined ? { offer_status: dto.offerStatus } : {}),
    ...(dto.userOffer !== undefined ? { user_offer: dto.userOffer } : {}),
    ...(dto.userCouponCode !== undefined
      ? { user_coupon_code: dto.userCouponCode }
      : {}),
    ...(dto.userOfferUrl !== undefined
      ? { user_offer_url: dto.userOfferUrl }
      : {}),
    ...(dto.memberOffer !== undefined ? { member_offer: dto.memberOffer } : {}),
    ...(dto.memberCouponCode !== undefined
      ? { member_coupon_code: dto.memberCouponCode }
      : {}),
    ...(dto.memberOfferUrl !== undefined
      ? { member_offer_url: dto.memberOfferUrl }
      : {}),
    ...(dto.offerTerms !== undefined ? { offer_terms: dto.offerTerms } : {}),
    ...(dto.offerExpiresAt !== undefined
      ? { offer_expires_at: dto.offerExpiresAt }
      : {}),
    ...(dto.isFeatured !== undefined ? { is_featured: dto.isFeatured } : {}),
    ...(dto.sortOrder !== undefined ? { sort_order: dto.sortOrder } : {}),
    ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
  };
}
export function mapLearning(row: LearningRow): AdminLearningDto {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    summary: row.summary,
    videoProvider: row.video_provider as AdminLearningDto['videoProvider'],
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    channel: row.channel,
    durationMinutes: row.duration_minutes,
    category: row.category as AdminLearningDto['category'],
    level: row.level as AdminLearningDto['level'],
    audiences: row.audiences as AdminLearningDto['audiences'],
    access: row.access as AdminLearningDto['access'],
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}
export function learningInsert(
  dto: import('@shared/resource').CreateLearningRequest,
): import('../supabase/database.types').Database['public']['Tables']['learnings']['Insert'] {
  return {
    title: dto.title,
    summary: dto.summary,
    video_provider: dto.videoProvider,
    video_url: dto.videoUrl,
    thumbnail_url: dto.thumbnailUrl,
    channel: dto.channel,
    duration_minutes: dto.durationMinutes,
    category: dto.category,
    level: dto.level,
    audiences: dto.audiences,
    access: dto.access,
    is_featured: dto.isFeatured,
    sort_order: dto.sortOrder,
    is_active: dto.isActive,
  };
}
export function learningUpdate(
  dto: import('@shared/resource').UpdateLearningRequest,
): import('../supabase/database.types').Database['public']['Tables']['learnings']['Update'] {
  return {
    ...(dto.title !== undefined ? { title: dto.title } : {}),
    ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
    ...(dto.videoProvider !== undefined
      ? { video_provider: dto.videoProvider }
      : {}),
    ...(dto.videoUrl !== undefined ? { video_url: dto.videoUrl } : {}),
    ...(dto.thumbnailUrl !== undefined
      ? { thumbnail_url: dto.thumbnailUrl }
      : {}),
    ...(dto.channel !== undefined ? { channel: dto.channel } : {}),
    ...(dto.durationMinutes !== undefined
      ? { duration_minutes: dto.durationMinutes }
      : {}),
    ...(dto.category !== undefined ? { category: dto.category } : {}),
    ...(dto.level !== undefined ? { level: dto.level } : {}),
    ...(dto.audiences !== undefined ? { audiences: dto.audiences } : {}),
    ...(dto.access !== undefined ? { access: dto.access } : {}),
    ...(dto.isFeatured !== undefined ? { is_featured: dto.isFeatured } : {}),
    ...(dto.sortOrder !== undefined ? { sort_order: dto.sortOrder } : {}),
    ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
  };
}
export function mapCollection(row: CollectionRow): AdminCollectionDto {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    kind: row.kind as AdminCollectionDto['kind'],
    slug: row.slug,
    title: row.title,
    description: row.description,
    audiences: row.audiences as AdminCollectionDto['audiences'],
    itemIds: row.item_ids,
    coverImageUrl: row.cover_image_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}
export function collectionInsert(
  dto: import('@shared/resource').CreateCollectionRequest,
  slug: string,
): import('../supabase/database.types').Database['public']['Tables']['collections']['Insert'] {
  return {
    kind: dto.kind,
    slug,
    title: dto.title,
    description: dto.description,
    audiences: dto.audiences,
    item_ids: dto.itemIds,
    cover_image_url: dto.coverImageUrl,
    sort_order: dto.sortOrder,
    is_active: dto.isActive,
  };
}
export function collectionUpdate(
  dto: import('@shared/resource').UpdateCollectionRequest,
): import('../supabase/database.types').Database['public']['Tables']['collections']['Update'] {
  return {
    ...(dto.kind !== undefined ? { kind: dto.kind } : {}),
    ...(dto.title !== undefined ? { title: dto.title } : {}),
    ...(dto.description !== undefined ? { description: dto.description } : {}),
    ...(dto.audiences !== undefined ? { audiences: dto.audiences } : {}),
    ...(dto.itemIds !== undefined ? { item_ids: dto.itemIds } : {}),
    ...(dto.coverImageUrl !== undefined
      ? { cover_image_url: dto.coverImageUrl }
      : {}),
    ...(dto.sortOrder !== undefined ? { sort_order: dto.sortOrder } : {}),
    ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
  };
}
export function mapTemplate(
  row: import('./resources.repository').TemplateRow,
): import('@shared/resource').AdminTemplateDto {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category as import('@shared/resource').TemplateCategory,
    highlights: row.highlights,
    filePath: row.file_path,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    fileType: row.file_type as import('@shared/resource').TemplateFileType,
    previewImageUrl: row.preview_image_url,
    audiences: row.audiences as import('@shared/resource').ResourceAudience[],
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}
export function templateInsert(
  dto: import('@shared/resource').CreateTemplateRequest,
  slug: string,
): import('../supabase/database.types').Database['public']['Tables']['templates']['Insert'] {
  return {
    slug,
    title: dto.title,
    description: dto.description,
    category: dto.category,
    highlights: dto.highlights,
    file_path: dto.filePath,
    file_name: dto.fileName,
    file_size_bytes: dto.fileSizeBytes,
    file_type: dto.fileType,
    preview_image_url: dto.previewImageUrl,
    audiences: dto.audiences,
    is_featured: dto.isFeatured,
    sort_order: dto.sortOrder,
    is_active: dto.isActive,
  };
}
export function templateUpdate(
  dto: import('@shared/resource').UpdateTemplateRequest,
): import('../supabase/database.types').Database['public']['Tables']['templates']['Update'] {
  return {
    ...(dto.title !== undefined ? { title: dto.title } : {}),
    ...(dto.description !== undefined ? { description: dto.description } : {}),
    ...(dto.category !== undefined ? { category: dto.category } : {}),
    ...(dto.highlights !== undefined ? { highlights: dto.highlights } : {}),
    ...(dto.filePath !== undefined ? { file_path: dto.filePath } : {}),
    ...(dto.fileName !== undefined ? { file_name: dto.fileName } : {}),
    ...(dto.fileSizeBytes !== undefined ? { file_size_bytes: dto.fileSizeBytes } : {}),
    ...(dto.fileType !== undefined ? { file_type: dto.fileType } : {}),
    ...(dto.previewImageUrl !== undefined ? { preview_image_url: dto.previewImageUrl } : {}),
    ...(dto.audiences !== undefined ? { audiences: dto.audiences } : {}),
    ...(dto.isFeatured !== undefined ? { is_featured: dto.isFeatured } : {}),
    ...(dto.sortOrder !== undefined ? { sort_order: dto.sortOrder } : {}),
    ...(dto.isActive !== undefined ? { is_active: dto.isActive } : {}),
  };
}
