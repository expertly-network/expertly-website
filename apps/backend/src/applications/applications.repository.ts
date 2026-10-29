import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import { generateUniqueSlug } from '../common/slugify';
import type { Database } from '../supabase/database.types';
import type { ApplicationStatus } from '@shared/membership-application';
import { MAX_LIST_ROWS } from '../common/list-limits';

// Statuses an admin can still approve or reject.
const REVIEWABLE_STATUSES: ApplicationStatus[] = ['submitted', 'under_review'];

// Public: the applicant photo, reused as the member's directory photo once approved.
const PHOTO_BUCKET = 'application-assets';
// Private: vetting documents, served only as short-lived signed URLs (applicant + admins).
const DOCUMENT_BUCKET = 'application-documents';
// Where documents lived (in the public bucket) before the private bucket existed.
const LEGACY_DOCUMENT_PREFIX = 'members/application/';

// Every column on membership_applications.
const APPLICATION_ROW_COLUMNS = [
  'id',
  'applicant_id',
  'status',
  'current_step',
  'photo_path',
  'first_name',
  'last_name',
  'contact_email',
  'phone_country_code',
  'phone',
  'region',
  'country',
  'state',
  'city',
  'linkedin_url',
  'bio',
  'years_of_experience',
  'work_experiences',
  'educations',
  'peer_references',
  'documents',
  'service_preferences',
  'rate_min_cents',
  'rate_max_cents',
  'selected_tier',
  'billing_period',
  'list_price_cents',
  'coupon_code',
  'discount_amount_cents',
  'amount_due_cents',
  'payment_status',
  'linkedin_import_consent',
  'terms_version_agreed',
  'privacy_version_agreed',
  'background_check_consent',
  'reviewed_by',
  'reviewed_at',
  'rejection_reason',
  'created_at',
  'updated_at',
] as const;

// Every column aliased to its AdminApplicationListItemDto camelCase name — listForReview()
// returns this cast straight to the DTO with no manual row mapping, unlike the rest of this
// file, so an unaliased column here silently comes back undefined on the DTO.
const ADMIN_LIST_COLUMNS = [
  'id',
  'status',
  'firstName:first_name',
  'lastName:last_name',
  'contactEmail:contact_email',
  'phoneCountryCode:phone_country_code',
  'phone',
  'linkedinUrl:linkedin_url',
  'yearsOfExperience:years_of_experience',
  'country',
  'state',
  'selectedTier:selected_tier',
  'billingPeriod:billing_period',
  'amountDueCents:amount_due_cents',
  'paymentStatus:payment_status',
  'createdAt:created_at',
  // Only ever set when status is 'rejected'.
  'rejectionReason:rejection_reason',
  // Raw {serviceId, priority, customLabel}[] — resolved to full ServicePreference (with
  // name/category) in the service layer, same as the applicant-facing ApplicationDto.
  'servicePreferences:service_preferences',
] as const;

export type ApplicationRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// membership_applications' write shape is built from a runtime column-name map
// (WRITABLE_COLUMNS in applications.service.ts), not literal properties, so insert/update here
// stay loosely typed and are cast to the generated shape at the Supabase call site instead.
type MembershipApplicationInsert = Database['public']['Tables']['membership_applications']['Insert'];
type MembershipApplicationUpdate = Database['public']['Tables']['membership_applications']['Update'];

export type MemberProfileInsert = Database['public']['Tables']['member_profiles']['Insert'];

export interface ServiceDetail {
  name: string;
  categoryId: string;
  categoryName: string;
  isCustom: boolean;
  isActive: boolean;
}

@Injectable()
export class ApplicationsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private membershipApplications() {
    return this.supabase.db.from('membership_applications');
  }

  private memberProfiles() {
    return this.supabase.db.from('member_profiles');
  }

  private memberServices() {
    return this.supabase.db.from('member_services');
  }

  private profiles() {
    return this.supabase.db.from('profiles');
  }

  private services() {
    return this.supabase.db.from('services');
  }

  private categories() {
    return this.supabase.db.from('categories');
  }

  async findLatestByApplicant(userId: string): Promise<ApplicationRow | null> {
    const { data, error } = await this.membershipApplications()
      .select(APPLICATION_ROW_COLUMNS.join(', '))
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load application.');
    return data as unknown as ApplicationRow | null;
  }

  // Returns null on error, same as when no draft exists.
  async findLatestForUpload(userId: string): Promise<ApplicationRow | null> {
    const { data, error } = await this.membershipApplications()
      .select(APPLICATION_ROW_COLUMNS.join(', '))
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data as unknown as ApplicationRow | null;
  }

  async insert(row: Record<string, unknown>): Promise<ApplicationRow> {
    const { data: saved, error } = await this.membershipApplications()
      .insert(row as MembershipApplicationInsert)
      .select(APPLICATION_ROW_COLUMNS.join(', '))
      .single();

    // 23505 = membership_applications_one_open_per_applicant: a concurrent request already
    // created this applicant's open application — the caller should reload and retry.
    if (error?.code === '23505') {
      throw new ConflictException({
        code: 'APPLICATION_ALREADY_OPEN',
        message: 'You already have an open application — reload and try again.',
      });
    }
    if (error || !saved) throw new InternalServerErrorException('Failed to save application.');
    return saved as unknown as ApplicationRow;
  }

  async updateById(id: string, patch: Record<string, unknown>): Promise<ApplicationRow> {
    const { data: saved, error } = await this.membershipApplications()
      .update(patch as MembershipApplicationUpdate)
      .eq('id', id)
      .select(APPLICATION_ROW_COLUMNS.join(', '))
      .single();

    if (error || !saved) throw new InternalServerErrorException('Failed to save application.');
    return saved as unknown as ApplicationRow;
  }

  async findByIdForReview(id: string): Promise<ApplicationRow> {
    const { data, error } = await this.membershipApplications()
      .select(APPLICATION_ROW_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load application.');
    if (!data) throw new NotFoundException('Application not found.');
    return data as unknown as ApplicationRow;
  }

  // Records a review decision only if the application is still awaiting one — a conditional
  // update, so two concurrent reviews can't both win. False when another review got there first.
  async claimForDecision(id: string, patch: MembershipApplicationUpdate): Promise<boolean> {
    const { data, error } = await this.membershipApplications()
      .update(patch)
      .eq('id', id)
      .in('status', REVIEWABLE_STATUSES)
      .select('id');
    if (error) throw new InternalServerErrorException('Failed to record review decision.');
    return (data ?? []).length > 0;
  }

  // Undoes claimForDecision when provisioning the member fails part-way (see reviewApplication).
  async revertDecision(id: string, previousStatus: ApplicationStatus): Promise<void> {
    const { error } = await this.membershipApplications()
      .update({ status: previousStatus, reviewed_by: null, reviewed_at: null })
      .eq('id', id);
    if (error) throw new InternalServerErrorException('Failed to revert review decision.');
  }

  // Rollback of a half-provisioned approval; member_services rows cascade with the profile.
  async deleteMemberProfile(profileId: string): Promise<void> {
    const { error } = await this.memberProfiles().delete().eq('profile_id', profileId);
    if (error) throw new InternalServerErrorException('Failed to remove member profile.');
  }

  // Same mechanism events/articles use for their own slugs — kebab-case, `-2`/`-3`/... suffix on
  // collision against member_profiles.slug.
  async findUniqueMemberSlug(name: string): Promise<string> {
    return generateUniqueSlug(this.supabase.db, 'member_profiles', name, 'member');
  }

  async insertMemberProfile(row: MemberProfileInsert): Promise<void> {
    const { error } = await this.memberProfiles().insert(row);
    if (error) throw new InternalServerErrorException('Failed to provision member profile.');
  }

  async insertMemberServices(rows: { member_id: string; service_id: string; custom_label: string | null }[]): Promise<void> {
    const { error } = await this.memberServices().insert(rows);
    if (error) throw new InternalServerErrorException('Failed to provision member services.');
  }

  async promoteToMember(applicantId: string): Promise<void> {
    const { error } = await this.profiles().update({ role: 'member' }).eq('id', applicantId);
    if (error) throw new InternalServerErrorException('Failed to promote applicant to member.');
  }

  // 🛡️ manageApplications — lighter column set than APPLICATION_ROW_COLUMNS for the list view.
  // service_preferences comes back raw ({serviceId, priority, customLabel}[]) — the service layer
  // resolves it to the full ServicePreference shape, same as ApplicationDto.
  async listForReview(status?: ApplicationStatus): Promise<ApplicationRow[]> {
    let query = this.membershipApplications()
      .select(ADMIN_LIST_COLUMNS.join(', '))
      .order('created_at', { ascending: false })
      .limit(MAX_LIST_ROWS);

    // Unfiltered default is every status — the admin UI's own status filter (client-side) is what
    // narrows this down; the backend no longer pre-excludes 'draft'/'approved' rows (changed
    // 2026-09-27, see docs/rest-api.md).
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException('Failed to load applications.');
    return (data ?? []) as unknown as ApplicationRow[];
  }

  async findServiceDetails(ids: string[]): Promise<Map<string, ServiceDetail>> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return new Map();

    const { data: services, error: servicesError } = await this.services()
      .select('id, name, category_id, is_custom, is_active')
      .in('id', uniqueIds);
    if (servicesError) throw new InternalServerErrorException('Failed to resolve services.');

    const categoryIds = [...new Set((services ?? []).map((s) => s.category_id as string))];
    const categoryNameById = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data: categories, error: categoriesError } = await this.categories().select('id, name').in('id', categoryIds);
      if (categoriesError) throw new InternalServerErrorException('Failed to resolve categories.');
      for (const c of categories ?? []) categoryNameById.set(c.id as string, c.name as string);
    }

    return new Map(
      (services ?? []).map((s) => [
        s.id as string,
        {
          name: s.name as string,
          categoryId: s.category_id as string,
          categoryName: categoryNameById.get(s.category_id as string) ?? 'Unknown',
          isCustom: s.is_custom as boolean,
          isActive: s.is_active as boolean,
        },
      ])
    );
  }

  // Reads the `picture` claim off the caller's linked LinkedIn OAuth identity, if any — via the
  // Admin API (service-role only), not a table select; Supabase stores identities on auth.users,
  // not in a public-schema table this client can query directly.
  async findLinkedInPictureUrl(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase.db.auth.admin.getUserById(userId);
    if (error || !data.user) return null;
    const identity = data.user.identities?.find((i) => i.provider === 'linkedin_oidc');
    const picture = identity?.identity_data?.picture;
    return typeof picture === 'string' ? picture : null;
  }

  // Applicant photo — public application-assets bucket (it becomes the member's directory photo).
  async uploadPhoto(path: string, buffer: Buffer, contentType: string): Promise<void> {
    const { error } = await this.supabase.db.storage
      .from(PHOTO_BUCKET)
      .upload(path, buffer, { contentType, upsert: true });
    if (error) throw new InternalServerErrorException('Failed to store file.');
  }

  // Vetting documents (CVs, certificates, ID) — private bucket, never a public URL.
  async uploadDocument(path: string, buffer: Buffer, contentType: string): Promise<void> {
    const { error } = await this.supabase.db.storage
      .from(DOCUMENT_BUCKET)
      .upload(path, buffer, { contentType, upsert: false });
    if (error) throw new InternalServerErrorException('Failed to store file.');
  }

  // Short-lived read URLs for vetting documents, keyed by path. Documents uploaded before the
  // private bucket existed live under `members/application/…` in the public bucket until
  // scripts/migrate-application-documents.mjs moves them; those are signed from there.
  async createSignedDocumentUrls(paths: string[], expiresInSeconds: number): Promise<Record<string, string>> {
    const urls: Record<string, string> = {};
    const unique = [...new Set(paths)];
    const byBucket = new Map<string, string[]>();
    for (const path of unique) {
      const bucket = path.startsWith(LEGACY_DOCUMENT_PREFIX) ? PHOTO_BUCKET : DOCUMENT_BUCKET;
      byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), path]);
    }
    for (const [bucket, bucketPaths] of byBucket) {
      const { data, error } = await this.supabase.db.storage.from(bucket).createSignedUrls(bucketPaths, expiresInSeconds);
      if (error) throw new InternalServerErrorException('Failed to sign document URLs.');
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl && !entry.error) urls[entry.path] = entry.signedUrl;
      }
    }
    return urls;
  }

  async saveUploadReference(id: string, patch: Record<string, unknown>): Promise<ApplicationRow> {
    const { data: saved, error } = await this.membershipApplications()
      .update(patch as MembershipApplicationUpdate)
      .eq('id', id)
      .select(APPLICATION_ROW_COLUMNS.join(', '))
      .single();

    if (error || !saved) throw new InternalServerErrorException('Failed to save upload reference.');
    return saved as unknown as ApplicationRow;
  }

  // application-assets is a public bucket — this is a plain, permanent URL, not a signed one.
  // No network call, no expiry, safe to call on every read. Photos only — never documents.
  getPublicUrl(path: string): string {
    const { data } = this.supabase.db.storage.from(PHOTO_BUCKET).getPublicUrl(path);
    return data.publicUrl;
  }
}
