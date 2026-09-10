import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
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

const ADMIN_LIST_COLUMNS = [
  'id',
  'status',
  'first_name',
  'last_name',
  'contact_email',
  'country',
  'selected_tier',
  'billing_period',
  'amount_due_cents',
  'payment_status',
  'created_at',
] as const;

export type ApplicationRow = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export interface MemberProfileInsert {
  profile_id: string;
  bio: string | null;
  region: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  years_of_experience: number | null;
  rate_min_cents: number | null;
  rate_max_cents: number | null;
  member_tier: string | null;
  contact_email: string | null;
  linkedin_url: string | null;
  photo_url: string | null;
  application_id: string;
  is_verified: boolean;
  status: string;
}

@Injectable()
export class ApplicationsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  async findLatestByApplicant(userId: string): Promise<ApplicationRow | null> {
    const { data, error } = await this.supabase.db
      .from('membership_applications')
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
    const { data, error } = await this.supabase.db
      .from('membership_applications')
      .select(APPLICATION_ROW_COLUMNS.join(', '))
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data as unknown as ApplicationRow | null;
  }

  async insert(row: Record<string, unknown>): Promise<ApplicationRow> {
    const { data: saved, error } = await this.supabase.db
      .from('membership_applications')
      .insert(row)
      .select(APPLICATION_ROW_COLUMNS.join(', '))
      .single();

    if (error || !saved) throw new InternalServerErrorException('Failed to save application.');
    return saved as unknown as ApplicationRow;
  }

  async updateById(id: string, patch: Record<string, unknown>): Promise<ApplicationRow> {
    const { data: saved, error } = await this.supabase.db
      .from('membership_applications')
      .update(patch)
      .eq('id', id)
      .select(APPLICATION_ROW_COLUMNS.join(', '))
      .single();

    if (error || !saved) throw new InternalServerErrorException('Failed to save application.');
    return saved as unknown as ApplicationRow;
  }

  async findByIdForReview(id: string): Promise<ApplicationRow> {
    const { data, error } = await this.supabase.db
      .from('membership_applications')
      .select(APPLICATION_ROW_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load application.');
    if (!data) throw new NotFoundException('Application not found.');
    return data as unknown as ApplicationRow;
  }

  async applyRejection(id: string, patch: Record<string, unknown>): Promise<void> {
    const { error } = await this.supabase.db.from('membership_applications').update(patch).eq('id', id);
    if (error) throw new InternalServerErrorException('Failed to reject application.');
  }

  async insertMemberProfile(row: MemberProfileInsert): Promise<void> {
    const { error } = await this.supabase.db.from('member_profiles').insert(row);
    if (error) throw new InternalServerErrorException('Failed to provision member profile.');
  }

  async insertMemberServices(rows: { member_id: string; practice_area_id: string }[]): Promise<void> {
    const { error } = await this.supabase.db.from('member_services').insert(rows);
    if (error) throw new InternalServerErrorException('Failed to provision member services.');
  }

  async promoteToMember(applicantId: string): Promise<void> {
    const { error } = await this.supabase.db.from('profiles').update({ role: 'member' }).eq('id', applicantId);
    if (error) throw new InternalServerErrorException('Failed to promote applicant to member.');
  }

  async markApproved(id: string, reviewerId: string, reviewedAt: string): Promise<void> {
    const { error } = await this.supabase.db
      .from('membership_applications')
      .update({ status: 'approved', reviewed_by: reviewerId, reviewed_at: reviewedAt })
      .eq('id', id);
    if (error) throw new InternalServerErrorException('Failed to finalize application status.');
  }

  // 🛡️ manageApplications — lighter column set than APPLICATION_ROW_COLUMNS for the list view.
  async listForReview(status?: ApplicationStatus): Promise<AdminApplicationListItemDto[]> {
    let query = this.supabase.db
      .from('membership_applications')
      .select(ADMIN_LIST_COLUMNS.join(', '))
      .order('created_at', { ascending: false });

    query = status ? query.eq('status', status) : query.in('status', ['submitted', 'under_review']);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException('Failed to load applications.');
    return (data ?? []) as unknown as AdminApplicationListItemDto[];
  }

  // Resolves practice area names regardless of whether they're still active.
  async findPracticeAreaNames(ids: string[]): Promise<Map<string, string>> {
    const practiceAreaById = new Map<string, string>();
    if (ids.length === 0) return practiceAreaById;

    const { data, error } = await this.supabase.db.from('practice_areas').select('id, name').in('id', ids);
    if (error) throw new InternalServerErrorException('Failed to resolve service preferences.');

    for (const p of data ?? []) practiceAreaById.set(p.id, p.name);
    return practiceAreaById;
  }

  // Resolves practice area names for ids that are currently active only.
  async findActivePracticeAreaNames(ids: string[]): Promise<Map<string, string>> {
    const practiceAreaById = new Map<string, string>();
    if (ids.length === 0) return practiceAreaById;

    const { data, error } = await this.supabase.db
      .from('practice_areas')
      .select('id, name')
      .eq('is_active', true)
      .in('id', ids);
    if (error) throw new InternalServerErrorException('Failed to validate service preferences.');

    for (const p of data ?? []) practiceAreaById.set(p.id, p.name);
    return practiceAreaById;
  }

  async uploadFile(path: string, buffer: Buffer, contentType: string): Promise<void> {
    const { error } = await this.supabase.db.storage
      .from('application-assets')
      .upload(path, buffer, { contentType, upsert: true });
    if (error) throw new InternalServerErrorException('Failed to store file.');
  }

  async saveUploadReference(id: string, patch: Record<string, unknown>): Promise<ApplicationRow> {
    const { data: saved, error } = await this.supabase.db
      .from('membership_applications')
      .update(patch)
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
