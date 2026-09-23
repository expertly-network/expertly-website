import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';
import type { AdminApplicationListItemDto, ApplicationStatus } from '@shared/membership-application';

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
  'country',
  'selectedTier:selected_tier',
  'billingPeriod:billing_period',
  'amountDueCents:amount_due_cents',
  'paymentStatus:payment_status',
  'createdAt:created_at',
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

  async applyRejection(id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await this.membershipApplications()
      .update(patch as MembershipApplicationUpdate)
      .eq('id', id);
    if (error) throw new InternalServerErrorException('Failed to reject application.');
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

  async markApproved(id: string, reviewerId: string, reviewedAt: string): Promise<void> {
    const { error } = await this.membershipApplications()
      .update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: reviewedAt })
      .eq('id', id);
    if (error) throw new InternalServerErrorException('Failed to finalize application status.');
  }

  // 🛡️ manageApplications — lighter column set than APPLICATION_ROW_COLUMNS for the list view.
  async listForReview(status?: ApplicationStatus): Promise<AdminApplicationListItemDto[]> {
    let query = this.membershipApplications()
      .select(ADMIN_LIST_COLUMNS.join(', '))
      .order('created_at', { ascending: false });

    query = status ? query.eq('status', status) : query.in('status', ['submitted', 'under_review']);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException('Failed to load applications.');
    return (data ?? []) as unknown as AdminApplicationListItemDto[];
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

  async uploadFile(path: string, buffer: Buffer, contentType: string): Promise<void> {
    const { error } = await this.supabase.db.storage
      .from('application-assets')
      .upload(path, buffer, { contentType, upsert: true });
    if (error) throw new InternalServerErrorException('Failed to store file.');
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

  // Returns null if the signed URL couldn't be minted.
  async createSignedUrl(path: string): Promise<string | null> {
    const { data } = await this.supabase.db.storage.from('application-assets').createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  }
}
