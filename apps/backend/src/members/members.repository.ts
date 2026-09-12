import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';
import type { ApplicationRegion, MembershipTier } from '@shared/membership-application';
import type {
  MemberAward,
  MemberCredential,
  MemberEditSection,
  MemberEditStatus,
  MemberEducation,
  MemberEngagement,
  MemberKeyClient,
  MemberProfileStatus,
  MemberQualification,
  MemberTestimonial,
  MemberWorkExperience,
  RenewalPaymentStatus,
} from '@shared/member';

// Selects profile_id, not member_profiles' own surrogate id — profile_id is what the API
// exposes as MemberDto.id.
const MEMBER_PROFILE_COLUMNS = [
  'profile_id',
  'headline',
  'bio',
  'firm_name',
  'firm_website',
  'region',
  'country',
  'state',
  'city',
  'years_of_experience',
  'rate_min_cents',
  'rate_max_cents',
  'rate_currency',
  'member_tier',
  'is_available',
  'availability_notes',
  'contact_email',
  'contact_phone',
  'linkedin_url',
  'website',
  'is_verified',
  'photo_url',
  'status',
  'application_id',
  'membership_started_at',
  'renewal_payment_status',
] as const;

// Jsonb columns fetched only for the full-detail view, not the list view.
const MEMBER_DETAIL_JSONB_COLUMNS = [
  'work_experiences',
  'educations',
  'engagements',
  'qualifications',
  'credentials',
  'testimonials',
  'awards',
  'key_clients',
] as const;

const MEMBER_PROFILE_EDIT_COLUMNS = [
  'id',
  'member_id',
  'section',
  'payload',
  'proof_file_url',
  'proof_link',
  'status',
  'review_note',
  'reviewed_by',
  'reviewed_at',
  'submitted_at',
] as const;

const PROFILE_IDENTITY_COLUMNS = ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'initials'] as const;

export interface MemberProfileRow {
  profile_id: string;
  headline: string | null;
  bio: string | null;
  firm_name: string | null;
  firm_website: string | null;
  region: ApplicationRegion | null;
  country: string;
  state: string | null;
  city: string | null;
  years_of_experience: number;
  rate_min_cents: number | null;
  rate_max_cents: number | null;
  rate_currency: string;
  member_tier: MembershipTier;
  is_available: boolean;
  availability_notes: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  is_verified: boolean;
  photo_url: string | null;
  status: MemberProfileStatus;
  application_id: string | null;
  membership_started_at: string;
  renewal_payment_status: RenewalPaymentStatus | null;
}

export interface MemberProfileDetailRow extends MemberProfileRow {
  work_experiences: MemberWorkExperience[];
  educations: MemberEducation[];
  engagements: MemberEngagement[];
  qualifications: MemberQualification[];
  credentials: MemberCredential[];
  testimonials: MemberTestimonial[];
  awards: MemberAward[];
  key_clients: MemberKeyClient[];
}

export interface MemberProfileEditRow {
  id: string;
  member_id: string;
  section: MemberEditSection;
  payload: unknown;
  proof_file_url: string | null;
  proof_link: string | null;
  status: MemberEditStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  submitted_at: string;
}

export interface ProfileIdentityRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  initials: string | null;
}

export interface MemberListFilters {
  country?: string[];
  rateMinCents?: number;
  rateMaxCents?: number;
  q?: string;
  sort?: string;
}

export type MemberProfileUpdate = Database['public']['Tables']['member_profiles']['Update'];
export type MemberProfileEditInsert = Database['public']['Tables']['member_profile_edits']['Insert'];
export type MemberProfileEditUpdate = Database['public']['Tables']['member_profile_edits']['Update'];

@Injectable()
export class MembersRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private memberProfiles() {
    return this.supabase.db.from('member_profiles');
  }

  private memberProfileEdits() {
    return this.supabase.db.from('member_profile_edits');
  }

  private memberServices() {
    return this.supabase.db.from('member_services');
  }

  private practiceAreas() {
    return this.supabase.db.from('practice_areas');
  }

  private profiles() {
    return this.supabase.db.from('profiles');
  }

  async findActiveList(filters: MemberListFilters, range: { from: number; to: number }): Promise<MemberProfileRow[]> {
    let dbQuery = this.memberProfiles()
      .select(MEMBER_PROFILE_COLUMNS.join(', '))
      .eq('status', 'active');

    if (filters.country && filters.country.length > 0) dbQuery = dbQuery.in('country', filters.country);
    if (filters.rateMinCents !== undefined) dbQuery = dbQuery.gte('rate_max_cents', filters.rateMinCents);
    if (filters.rateMaxCents !== undefined) dbQuery = dbQuery.lte('rate_min_cents', filters.rateMaxCents);
    if (filters.q) {
      // Matches member_profiles' own text fields; name matching against profiles happens
      // separately, in-memory.
      dbQuery = dbQuery.or(`headline.ilike.%${filters.q}%,firm_name.ilike.%${filters.q}%`);
    }

    switch (filters.sort) {
      case 'tenure':
        dbQuery = dbQuery.order('years_of_experience', { ascending: false });
        break;
      case 'rate_asc':
        dbQuery = dbQuery.order('rate_min_cents', { ascending: true, nullsFirst: true });
        break;
      case 'rate_desc':
        dbQuery = dbQuery.order('rate_max_cents', { ascending: false, nullsFirst: false });
        break;
      default:
        dbQuery = dbQuery.order('is_verified', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data, error } = await dbQuery.range(range.from, range.to);
    if (error) throw new InternalServerErrorException('Failed to load members.');
    return (data ?? []) as unknown as MemberProfileRow[];
  }

  async findMemberIdsByPracticeAreas(practiceAreaIds: string[]): Promise<Set<string>> {
    const { data, error } = await this.memberServices().select('member_id').in('practice_area_id', practiceAreaIds);
    if (error) throw new InternalServerErrorException('Failed to filter by practice area.');
    return new Set((data ?? []).map((m) => m.member_id as string));
  }

  async findDetailByProfileId(id: string): Promise<MemberProfileDetailRow | null> {
    const { data, error } = await this.memberProfiles()
      .select([...MEMBER_PROFILE_COLUMNS, ...MEMBER_DETAIL_JSONB_COLUMNS].join(', '))
      .eq('profile_id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load member profile.');
    return data as unknown as MemberProfileDetailRow | null;
  }

  async createSignedUploadUrl(path: string): Promise<{ signedUrl: string; path: string }> {
    const { data, error } = await this.supabase.db.storage.from('member-proofs').createSignedUploadUrl(path);
    if (error || !data) throw new InternalServerErrorException('Failed to create upload URL.');
    return data;
  }

  async insertEdit(row: MemberProfileEditInsert): Promise<MemberProfileEditRow> {
    const { data: inserted, error } = await this.memberProfileEdits()
      .insert(row)
      .select(MEMBER_PROFILE_EDIT_COLUMNS.join(', '))
      .single();

    if (error || !inserted) throw new InternalServerErrorException('Failed to submit profile edit.');
    return inserted as unknown as MemberProfileEditRow;
  }

  async findEditsByMember(memberId: string): Promise<MemberProfileEditRow[]> {
    const { data, error } = await this.memberProfileEdits()
      .select(MEMBER_PROFILE_EDIT_COLUMNS.join(', '))
      .eq('member_id', memberId)
      .order('submitted_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load profile edits.');
    return (data ?? []) as unknown as MemberProfileEditRow[];
  }

  async adminFindAllProfiles(): Promise<MemberProfileRow[]> {
    const { data, error } = await this.memberProfiles().select(MEMBER_PROFILE_COLUMNS.join(', ') + ', status');

    if (error) throw new InternalServerErrorException('Failed to load members.');
    return (data ?? []) as unknown as MemberProfileRow[];
  }

  async adminUpdateProfile(id: string, patch: MemberProfileUpdate): Promise<MemberProfileRow> {
    const { data: updated, error } = await this.memberProfiles()
      .update(patch)
      .eq('profile_id', id)
      .select(MEMBER_PROFILE_COLUMNS.join(', ') + ', status')
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to update member.');
    if (!updated) throw new NotFoundException('Member profile not found.');
    return updated as unknown as MemberProfileRow;
  }

  async findAllEditsByStatus(status: string): Promise<MemberProfileEditRow[]> {
    const { data, error } = await this.memberProfileEdits()
      .select(MEMBER_PROFILE_EDIT_COLUMNS.join(', '))
      .eq('status', status as MemberEditStatus)
      .order('submitted_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load profile edits.');
    return (data ?? []) as unknown as MemberProfileEditRow[];
  }

  async findEditById(id: string): Promise<MemberProfileEditRow> {
    const { data, error } = await this.memberProfileEdits()
      .select(MEMBER_PROFILE_EDIT_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load profile edit.');
    if (!data) throw new NotFoundException('Profile edit not found.');
    return data as unknown as MemberProfileEditRow;
  }

  async updateEditDecision(id: string, patch: MemberProfileEditUpdate): Promise<MemberProfileEditRow> {
    const { data: updated, error } = await this.memberProfileEdits()
      .update(patch)
      .eq('id', id)
      .select(MEMBER_PROFILE_EDIT_COLUMNS.join(', '))
      .single();

    if (error || !updated) throw new InternalServerErrorException('Failed to record review decision.');
    return updated as unknown as MemberProfileEditRow;
  }

  async applyHeadlineBioEdit(memberId: string, headline: string, bio: string): Promise<void> {
    const { error } = await this.memberProfiles().update({ headline, bio }).eq('profile_id', memberId);
    if (error) throw new InternalServerErrorException('Failed to apply headline/bio edit.');
  }

  async applyContactEdit(
    memberId: string,
    contact: { contactEmail: string | null; contactPhone: string | null; linkedinUrl: string | null; website: string | null }
  ): Promise<void> {
    const { error } = await this.memberProfiles()
      .update({
        contact_email: contact.contactEmail,
        contact_phone: contact.contactPhone,
        linkedin_url: contact.linkedinUrl,
        website: contact.website,
      })
      .eq('profile_id', memberId);
    if (error) throw new InternalServerErrorException('Failed to apply contact edit.');
  }

  async applySectionEdit(memberId: string, column: string, section: string, items: Record<string, unknown>[]): Promise<void> {
    const { error } = await this.memberProfiles()
      .update({ [column]: items } as MemberProfileUpdate)
      .eq('profile_id', memberId);
    if (error) throw new InternalServerErrorException(`Failed to apply ${section} edit.`);
  }

  async findProfilesByIds(ids: string[]): Promise<Map<string, ProfileIdentityRow>> {
    const map = new Map<string, ProfileIdentityRow>();
    if (ids.length === 0) return map;

    const { data, error } = await this.profiles().select(PROFILE_IDENTITY_COLUMNS.join(', ')).in('id', ids);

    if (error) throw new InternalServerErrorException('Failed to load member identity.');
    for (const p of (data ?? []) as unknown as ProfileIdentityRow[]) map.set(p.id, p);
    return map;
  }

  async findMemberServicesByMemberIds(memberIds: string[]): Promise<Map<string, { id: string; name: string }[]>> {
    const map = new Map<string, { id: string; name: string }[]>();
    if (memberIds.length === 0) return map;

    const { data: links, error } = await this.memberServices()
      .select('member_id, practice_area_id')
      .in('member_id', memberIds);
    if (error) throw new InternalServerErrorException('Failed to load member practice areas.');

    const practiceAreaIds = [...new Set((links ?? []).map((l) => l.practice_area_id as string))];
    const practiceAreaById = new Map<string, string>();
    if (practiceAreaIds.length > 0) {
      const { data: areas } = await this.practiceAreas().select('id, name').in('id', practiceAreaIds);
      for (const a of areas ?? []) practiceAreaById.set(a.id as string, a.name as string);
    }

    for (const link of links ?? []) {
      const memberId = link.member_id as string;
      const practiceAreaId = link.practice_area_id as string;
      const list = map.get(memberId) ?? [];
      list.push({ id: practiceAreaId, name: practiceAreaById.get(practiceAreaId) ?? 'Unknown' });
      map.set(memberId, list);
    }
    return map;
  }
}
