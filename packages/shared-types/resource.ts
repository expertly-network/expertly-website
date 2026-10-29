export const PERK_CATEGORIES = [
  'Tax & Compliance',
  'Accounting & Audit',
  'Corporate Secretarial',
  'Legal',
  'AI Tools',
  'Practice & Productivity',
] as const;
export const LEARNING_CATEGORIES = [
  'AI essentials',
  'Legal & drafting',
  'Tax & accounting',
  'Audit & assurance',
  'Excel & decks',
  'Automation',
  'Data & privacy',
] as const;
export const TEMPLATE_CATEGORIES = [
  'Audit',
  'Tax',
  'Legal',
  'Corporate & compliance',
  'Practice management',
] as const;
export type PerkCategory = (typeof PERK_CATEGORIES)[number];
export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];
export type TemplateFileType = 'docx' | 'xlsx' | 'pptx' | 'pdf';
export type LearningCategory = (typeof LEARNING_CATEGORIES)[number];
export type ResourceAudience = 'tax' | 'legal' | 'audit';
export type ResourceLockReason =
  'sign_in' | 'membership' | 'coming_soon' | 'expired' | 'unavailable';

export interface CreatePerkRequest {
  name: string;
  category: PerkCategory;
  tagline?: string;
  description?: string;
  products?: string[];
  websiteUrl: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  offerStatus?: 'coming_soon' | 'live';
  userOffer?: string | null;
  userCouponCode?: string | null;
  userOfferUrl?: string | null;
  memberOffer?: string | null;
  memberCouponCode?: string | null;
  memberOfferUrl?: string | null;
  offerTerms?: string | null;
  offerExpiresAt?: string | null;
  isFeatured?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}
export type UpdatePerkRequest = Partial<CreatePerkRequest>;
export interface AdminPerkDto extends Required<CreatePerkRequest> {
  slug: string;
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearningRequest {
  title: string;
  summary?: string;
  videoProvider?: 'youtube' | 'file';
  videoUrl: string;
  thumbnailUrl?: string | null;
  channel?: string | null;
  durationMinutes: number;
  category: LearningCategory;
  level: 'beginner' | 'intermediate' | 'advanced';
  audiences?: ResourceAudience[];
  access?: 'auto' | 'open' | 'members';
  isFeatured?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}
export type UpdateLearningRequest = Partial<CreateLearningRequest>;
export interface AdminLearningDto extends Required<CreateLearningRequest> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCollectionRequest {
  kind: 'learning_playlist' | 'perk_stack' | 'template_kit';
  title: string;
  description?: string;
  audiences?: ResourceAudience[];
  itemIds?: string[];
  coverImageUrl?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}
export type UpdateCollectionRequest = Partial<CreateCollectionRequest>;
export interface AdminCollectionDto extends Required<CreateCollectionRequest> {
  slug: string;
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerkDto extends Pick<
  AdminPerkDto,
  | 'id'
  | 'slug'
  | 'name'
  | 'category'
  | 'tagline'
  | 'description'
  | 'products'
  | 'websiteUrl'
  | 'logoUrl'
  | 'coverImageUrl'
  | 'offerStatus'
  | 'isFeatured'
  | 'sortOrder'
> {
  offer: string | null;
  couponCode: string | null;
  offerUrl: string | null;
  offerTerms: string | null;
  offerExpiresAt: string | null;
  canRedeem: boolean;
  lockReason: ResourceLockReason | null;
}
export interface LearningDto extends Pick<
  AdminLearningDto,
  | 'id'
  | 'title'
  | 'summary'
  | 'thumbnailUrl'
  | 'channel'
  | 'durationMinutes'
  | 'category'
  | 'level'
  | 'audiences'
  | 'isFeatured'
  | 'sortOrder'
> {
  videoProvider: 'youtube' | 'file';
  videoUrl: string | null;
  canWatch: boolean;
  lockReason: 'sign_in' | 'membership' | null;
}
export interface CollectionDto extends Pick<
  AdminCollectionDto,
  | 'id'
  | 'kind'
  | 'slug'
  | 'title'
  | 'description'
  | 'audiences'
  | 'coverImageUrl'
  | 'sortOrder'
> {
  itemIds: string[];
  items: Array<PerkDto | LearningDto | TemplateDto>;
}

// Templates — every template is members-only. The stored file path is never part of a public
// DTO; a member gets a short-lived signed link from POST /v1/templates/:id/download.
export interface CreateTemplateRequest {
  title: string;
  description?: string;
  category: TemplateCategory;
  highlights?: string[];
  /** From POST /v1/admin/templates/upload — the server sniffs the real file type. */
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: TemplateFileType;
  /** Public teaser image: a resource-assets path (templates/...) or an HTTPS URL. */
  previewImageUrl?: string | null;
  audiences?: ResourceAudience[];
  isFeatured?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}
export type UpdateTemplateRequest = Partial<CreateTemplateRequest>;
export interface AdminTemplateDto extends Required<CreateTemplateRequest> {
  id: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}
export interface TemplateDto extends Pick<
  AdminTemplateDto,
  | 'id'
  | 'slug'
  | 'title'
  | 'description'
  | 'category'
  | 'highlights'
  | 'fileType'
  | 'fileName'
  | 'fileSizeBytes'
  | 'previewImageUrl'
  | 'audiences'
  | 'isFeatured'
  | 'sortOrder'
> {
  canDownload: boolean;
  lockReason: 'sign_in' | 'membership' | null;
}
// POST /v1/templates/:id/download — members/admins only.
export interface TemplateDownloadDto {
  url: string;
  fileName: string;
  expiresAt: string;
}
// POST /v1/admin/templates/upload — feed straight into Create/UpdateTemplateRequest.
export interface TemplateUploadDto {
  filePath: string;
  fileName: string;
  fileSizeBytes: number;
  fileType: TemplateFileType;
}
