import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  AdminMemberListItemDto,
  MemberDto,
  MemberListItemDto,
  MemberProfileEditDto,
  RenewalPolicyDto,
  RenewalDueState,
  UploadResponse,
} from '@shared/member';
import { CreateMemberEditDto } from './dto/create-member-edit.dto';
import { CreateUploadDto } from './dto/create-upload.dto';
import { ReviewMemberEditDto } from './dto/review-member-edit.dto';
import { UpdateAdminMemberDto } from './dto/update-admin-member.dto';
import { UpdateRenewalPolicyDto } from './dto/update-renewal-policy.dto';

const MEMBER_PROFILE_COLUMNS =
  'id, headline, bio, firm_name, firm_website, region, country, state, city, years_of_experience, ' +
  'rate_min_cents, rate_max_cents, rate_currency, member_tier, is_available, availability_notes, ' +
  'contact_email, contact_phone, linkedin_url, website, is_verified, photo_url, status, ' +
  'application_id, membership_started_at, renewal_payment_status';

// One field per self-edit-array-shaped child table, keyed by the section name that governs it —
// used by both listing (fetch all 8 in parallel) and admin-approval (replace-on-approval, see
// reviewEdit()).
const CHILD_TABLES = {
  work_experiences: 'member_work_experiences',
  education: 'member_educations',
  engagements: 'member_engagements',
  testimonials: 'member_testimonials',
  awards: 'member_awards',
  key_clients: 'member_key_clients',
} as const;

@Injectable()
export class MembersService {
  constructor(private readonly supabase: SupabaseService) {}

  async list(query: {
    q?: string;
    practiceAreaId?: string[];
    country?: string[];
    rateMinCents?: number;
    rateMaxCents?: number;
    sort?: string;
    page?: number;
    pageSize?: number;
  }): Promise<MemberListItemDto[]> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 8;

    let dbQuery = this.supabase.db
      .from('member_profiles')
      .select(MEMBER_PROFILE_COLUMNS)
      .eq('status', 'active');

    if (query.country && query.country.length > 0) dbQuery = dbQuery.in('country', query.country);
    if (query.rateMinCents !== undefined) dbQuery = dbQuery.gte('rate_max_cents', query.rateMinCents);
    if (query.rateMaxCents !== undefined) dbQuery = dbQuery.lte('rate_min_cents', query.rateMaxCents);
    if (query.q) {
      // No cross-table (profiles.first_name/last_name) search in this query — matched separately
      // below, since Supabase's `or()` can't span two tables in one call without a DB view. This
      // filters on member_profiles' own text fields only; name matching happens client-side on
      // the merged result.
      dbQuery = dbQuery.or(`headline.ilike.%${query.q}%,firm_name.ilike.%${query.q}%`);
    }

    switch (query.sort) {
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

    const { data, error } = await dbQuery.range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new InternalServerErrorException('Failed to load members.');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rows = (data ?? []) as any[];

    if (query.practiceAreaId && query.practiceAreaId.length > 0) {
      const { data: matches, error: matchError } = await this.supabase.db
        .from('member_services')
        .select('member_id')
        .in('practice_area_id', query.practiceAreaId);
      if (matchError) throw new InternalServerErrorException('Failed to filter by practice area.');
      const matchedIds = new Set((matches ?? []).map((m) => m.member_id));
      rows = rows.filter((r) => matchedIds.has(r.id));
    }

    const [profilesById, servicesByMember] = await Promise.all([
      this.loadProfiles(rows.map((r) => r.id)),
      this.loadMemberServices(rows.map((r) => r.id)),
    ]);

    let items = rows.map((row) => this.toListDto(row, profilesById, servicesByMember));

    if (query.q) {
      const q = query.q.toLowerCase();
      items = items.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.headline ?? '').toLowerCase().includes(q) ||
          (m.firmName ?? '').toLowerCase().includes(q)
      );
    }

    return items;
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<MemberDto> {
    const { data: row, error } = (await this.supabase.db
      .from('member_profiles')
      .select(MEMBER_PROFILE_COLUMNS)
      .eq('id', id)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .maybeSingle()) as any;

    if (error) throw new InternalServerErrorException('Failed to load member profile.');
    // Don't leak existence of a deactivated/non-own profile — 404, not 403, same posture as a
    // draft article the caller can't see.
    if (!row || (row.status !== 'active' && row.id !== user.id)) {
      throw new NotFoundException('Member profile not found.');
    }

    const [profilesById, servicesByMember, children] = await Promise.all([
      this.loadProfiles([row.id]),
      this.loadMemberServices([row.id]),
      this.loadAllChildren(row.id),
    ]);

    return {
      ...this.toListDto(row, profilesById, servicesByMember),
      bio: row.bio,
      firmWebsite: row.firm_website,
      availabilityNotes: row.availability_notes,
      isAvailable: row.is_available,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      linkedinUrl: row.linkedin_url,
      website: row.website,
      ...children,
    };
  }

  async requestUpload(memberId: string, user: AuthenticatedUser, dto: CreateUploadDto): Promise<UploadResponse> {
    this.assertOwner(memberId, user);

    const path = `${memberId}/${Date.now()}-${dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data, error } = await this.supabase.db.storage
      .from('member-proofs')
      .createSignedUploadUrl(path);

    if (error || !data) throw new InternalServerErrorException('Failed to create upload URL.');
    return { uploadUrl: data.signedUrl, path: data.path };
  }

  async createEdit(memberId: string, user: AuthenticatedUser, dto: CreateMemberEditDto): Promise<MemberProfileEditDto> {
    this.assertOwner(memberId, user);
    this.validateEditPayloadShape(dto);

    const { data: inserted, error } = await this.supabase.db
      .from('member_profile_edits')
      .insert({
        member_id: memberId,
        section: dto.section,
        payload: dto.payload,
        proof_file_url: dto.proofFileUrl ?? null,
        proof_link: dto.proofLink ?? null,
      })
      .select()
      .single();

    if (error || !inserted) throw new InternalServerErrorException('Failed to submit profile edit.');
    return this.toEditDto(inserted, user.firstName + ' ' + user.lastName);
  }

  async listMyEdits(memberId: string, user: AuthenticatedUser): Promise<MemberProfileEditDto[]> {
    this.assertOwner(memberId, user);

    const { data, error } = await this.supabase.db
      .from('member_profile_edits')
      .select()
      .eq('member_id', memberId)
      .order('submitted_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load profile edits.');
    return (data ?? []).map((row) => this.toEditDto(row, user.firstName + ' ' + user.lastName));
  }

  // ---------------------------------------------------------------------------------------------
  // Admin
  // ---------------------------------------------------------------------------------------------

  async adminList(): Promise<AdminMemberListItemDto[]> {
    const [{ data: rows, error }, policy] = await Promise.all([
      this.supabase.db.from('member_profiles').select(MEMBER_PROFILE_COLUMNS + ', status'),
      this.getRenewalPolicy(),
    ]);
    if (error) throw new InternalServerErrorException('Failed to load members.');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memberRows = (rows ?? []) as any[];
    const [profilesById, servicesByMember] = await Promise.all([
      this.loadProfiles(memberRows.map((r) => r.id)),
      this.loadMemberServices(memberRows.map((r) => r.id)),
    ]);

    return memberRows.map((row) => ({
      ...this.toListDto(row, profilesById, servicesByMember),
      status: row.status,
      applicationId: row.application_id,
      membershipStartedAt: row.membership_started_at,
      renewalPaymentStatus: row.renewal_payment_status,
      renewalDueState: this.computeDueState(row.membership_started_at, policy),
    }));
  }

  async adminUpdateMember(id: string, dto: UpdateAdminMemberDto): Promise<AdminMemberListItemDto> {
    const patch: Record<string, unknown> = {};
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.membershipStartedAt !== undefined) patch.membership_started_at = dto.membershipStartedAt;
    if (dto.renewalPaymentStatus !== undefined) patch.renewal_payment_status = dto.renewalPaymentStatus;

    const { data: updated, error } = (await this.supabase.db
      .from('member_profiles')
      .update(patch)
      .eq('id', id)
      .select(MEMBER_PROFILE_COLUMNS + ', status')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .maybeSingle()) as any;

    if (error) throw new InternalServerErrorException('Failed to update member.');
    if (!updated) throw new NotFoundException('Member profile not found.');

    const [profilesById, servicesByMember, policy] = await Promise.all([
      this.loadProfiles([updated.id]),
      this.loadMemberServices([updated.id]),
      this.getRenewalPolicy(),
    ]);

    return {
      ...this.toListDto(updated, profilesById, servicesByMember),
      status: updated.status,
      applicationId: updated.application_id,
      membershipStartedAt: updated.membership_started_at,
      renewalPaymentStatus: updated.renewal_payment_status,
      renewalDueState: this.computeDueState(updated.membership_started_at, policy),
    };
  }

  async adminListEdits(status?: string): Promise<MemberProfileEditDto[]> {
    let query = this.supabase.db.from('member_profile_edits').select();
    query = query.eq('status', status ?? 'pending');

    const { data, error } = await query.order('submitted_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to load profile edits.');

    const rows = data ?? [];
    const profilesById = await this.loadProfiles(rows.map((r) => r.member_id));
    return rows.map((row) => this.toEditDto(row, this.fullName(profilesById.get(row.member_id))));
  }

  async adminReviewEdit(id: string, admin: AuthenticatedUser, dto: ReviewMemberEditDto): Promise<MemberProfileEditDto> {
    const { data: edit, error } = await this.supabase.db
      .from('member_profile_edits')
      .select()
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load profile edit.');
    if (!edit) throw new NotFoundException('Profile edit not found.');
    if (edit.status !== 'pending') {
      throw new ConflictException('This edit has already been reviewed.');
    }

    if (dto.status === 'verified') {
      await this.applyEdit(edit);
    }

    const { data: updated, error: updateError } = await this.supabase.db
      .from('member_profile_edits')
      .update({
        status: dto.status,
        review_note: dto.reviewNote ?? null,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError || !updated) throw new InternalServerErrorException('Failed to record review decision.');

    const profilesById = await this.loadProfiles([updated.member_id]);
    return this.toEditDto(updated, this.fullName(profilesById.get(updated.member_id)));
  }

  async getRenewalPolicy(): Promise<RenewalPolicyDto> {
    const { data, error } = await this.supabase.db
      .from('member_renewal_policy')
      .select('period_months, reminder_days, updated_at')
      .eq('id', 1)
      .single();

    if (error || !data) throw new InternalServerErrorException('Failed to load renewal policy.');
    return { periodMonths: data.period_months, reminderDays: data.reminder_days, updatedAt: data.updated_at };
  }

  async updateRenewalPolicy(dto: UpdateRenewalPolicyDto): Promise<RenewalPolicyDto> {
    const patch: Record<string, unknown> = {};
    if (dto.periodMonths !== undefined) patch.period_months = dto.periodMonths;
    if (dto.reminderDays !== undefined) patch.reminder_days = dto.reminderDays;

    const { data, error } = await this.supabase.db
      .from('member_renewal_policy')
      .update(patch)
      .eq('id', 1)
      .select('period_months, reminder_days, updated_at')
      .single();

    if (error || !data) throw new InternalServerErrorException('Failed to update renewal policy.');
    return { periodMonths: data.period_months, reminderDays: data.reminder_days, updatedAt: data.updated_at };
  }

  // ---------------------------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------------------------

  private assertOwner(memberId: string, user: AuthenticatedUser): void {
    if (user.id !== memberId) {
      throw new ForbiddenException('You can only edit your own member profile.');
    }
  }

  // On approval, an array-shaped section's payload wholesale-replaces that member's child rows
  // for the section; headline_bio/contact overwrite member_profiles columns directly. See
  // docs/database-erd.md's "whole-section-request workflow" note.
  private async applyEdit(edit: { member_id: string; section: string; payload: unknown }): Promise<void> {
    const { member_id: memberId, section, payload } = edit;

    if (section === 'headline_bio') {
      const p = payload as { headline: string; bio: string };
      const { error } = await this.supabase.db
        .from('member_profiles')
        .update({ headline: p.headline, bio: p.bio })
        .eq('id', memberId);
      if (error) throw new InternalServerErrorException('Failed to apply headline/bio edit.');
      return;
    }

    if (section === 'contact') {
      const p = payload as {
        contactEmail: string | null;
        contactPhone: string | null;
        linkedinUrl: string | null;
        website: string | null;
      };
      const { error } = await this.supabase.db
        .from('member_profiles')
        .update({
          contact_email: p.contactEmail,
          contact_phone: p.contactPhone,
          linkedin_url: p.linkedinUrl,
          website: p.website,
        })
        .eq('id', memberId);
      if (error) throw new InternalServerErrorException('Failed to apply contact edit.');
      return;
    }

    const table = CHILD_TABLES[section as keyof typeof CHILD_TABLES];
    if (!table) throw new BadRequestException(`Unknown edit section: ${section}`);

    const items = (payload as Record<string, unknown>[]).map((item) => this.toSnakeCaseRow(item, memberId));

    const { error: deleteError } = await this.supabase.db.from(table).delete().eq('member_id', memberId);
    if (deleteError) throw new InternalServerErrorException(`Failed to clear existing ${section}.`);

    if (items.length > 0) {
      const { error: insertError } = await this.supabase.db.from(table).insert(items);
      if (insertError) throw new InternalServerErrorException(`Failed to apply ${section} edit.`);
    }
  }

  // Minimal camelCase -> snake_case mapping for the known child-row shapes — not a general-purpose
  // utility, just enough for the 6 array-shaped sections' known field names.
  private toSnakeCaseRow(item: Record<string, unknown>, memberId: string): Record<string, unknown> {
    const out: Record<string, unknown> = { member_id: memberId };
    for (const [key, value] of Object.entries(item)) {
      const snake = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
      out[snake] = value;
    }
    return out;
  }

  private validateEditPayloadShape(dto: CreateMemberEditDto): void {
    if (dto.section === 'headline_bio') {
      const p = dto.payload as { headline?: unknown; bio?: unknown };
      if (typeof p.headline !== 'string' || typeof p.bio !== 'string') {
        throw new BadRequestException('headline_bio payload requires headline and bio strings.');
      }
      return;
    }
    if (dto.section === 'contact') {
      return; // all fields nullable — nothing to require
    }
    if (!Array.isArray(dto.payload)) {
      throw new BadRequestException(`${dto.section} payload must be an array.`);
    }
  }

  private computeDueState(membershipStartedAt: string, policy: RenewalPolicyDto): RenewalDueState {
    const start = new Date(membershipStartedAt);
    const due = new Date(start);
    due.setMonth(due.getMonth() + policy.periodMonths);

    const now = new Date();
    const reminderStart = new Date(due);
    reminderStart.setDate(reminderStart.getDate() - policy.reminderDays);

    if (now >= due) return 'overdue';
    if (now >= reminderStart) return 'due-soon';
    return 'active';
  }

  private fullName(profile?: { first_name: string; last_name: string }): string {
    if (!profile) return 'Unknown member';
    return `${profile.first_name} ${profile.last_name}`.trim();
  }

  private async loadProfiles(
    ids: string[]
  ): Promise<Map<string, { first_name: string; last_name: string; email: string; avatar_url: string | null; initials: string | null }>> {
    const map = new Map();
    if (ids.length === 0) return map;

    const { data, error } = await this.supabase.db
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url, initials')
      .in('id', ids);

    if (error) throw new InternalServerErrorException('Failed to load member identity.');
    for (const p of data ?? []) map.set(p.id, p);
    return map;
  }

  private async loadMemberServices(memberIds: string[]): Promise<Map<string, { id: string; name: string }[]>> {
    const map = new Map<string, { id: string; name: string }[]>();
    if (memberIds.length === 0) return map;

    const { data: links, error } = await this.supabase.db
      .from('member_services')
      .select('member_id, practice_area_id')
      .in('member_id', memberIds);
    if (error) throw new InternalServerErrorException('Failed to load member practice areas.');

    const practiceAreaIds = [...new Set((links ?? []).map((l) => l.practice_area_id))];
    const practiceAreaById = new Map<string, string>();
    if (practiceAreaIds.length > 0) {
      const { data: areas } = await this.supabase.db
        .from('practice_areas')
        .select('id, name')
        .in('id', practiceAreaIds);
      for (const a of areas ?? []) practiceAreaById.set(a.id, a.name);
    }

    for (const link of links ?? []) {
      const list = map.get(link.member_id) ?? [];
      list.push({ id: link.practice_area_id, name: practiceAreaById.get(link.practice_area_id) ?? 'Unknown' });
      map.set(link.member_id, list);
    }
    return map;
  }

  private async loadAllChildren(memberId: string) {
    const [work, edu, eng, qual, cred, testi, awards, clients] = await Promise.all([
      this.supabase.db.from('member_work_experiences').select().eq('member_id', memberId),
      this.supabase.db.from('member_educations').select().eq('member_id', memberId),
      this.supabase.db.from('member_engagements').select().eq('member_id', memberId),
      this.supabase.db.from('member_qualifications').select().eq('member_id', memberId),
      this.supabase.db.from('member_credentials').select().eq('member_id', memberId),
      this.supabase.db.from('member_testimonials').select().eq('member_id', memberId),
      this.supabase.db.from('member_awards').select().eq('member_id', memberId),
      this.supabase.db.from('member_key_clients').select().eq('member_id', memberId),
    ]);

    return {
      workExperiences: (work.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        company: r.company,
        startYear: r.start_year,
        endYear: r.end_year,
        isCurrent: r.is_current,
        description: r.description,
      })),
      educations: (edu.data ?? []).map((r) => ({
        id: r.id,
        degree: r.degree,
        institution: r.institution,
        field: r.field,
        endYear: r.end_year,
      })),
      engagements: (eng.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        organization: r.organization,
        year: r.year,
        url: r.url,
      })),
      qualifications: (qual.data ?? []).map((r) => ({ id: r.id, name: r.name, year: r.year })),
      credentials: (cred.data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        issuingBody: r.issuing_body,
        year: r.year,
        isVerified: r.is_verified,
      })),
      testimonials: (testi.data ?? []).map((r) => ({
        id: r.id,
        quote: r.quote,
        clientName: r.client_name,
        clientTitle: r.client_title,
        clientCompany: r.client_company,
        serviceName: r.service_name,
        occurredOn: r.occurred_on,
        isVerified: r.is_verified,
      })),
      awards: (awards.data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        issuingBody: r.issuing_body,
        year: r.year,
        description: r.description,
      })),
      keyClients: (clients.data ?? []).map((r) => ({ id: r.id, name: r.name, logoUrl: r.logo_url })),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toListDto(row: any, profilesById: Map<string, any>, servicesByMember: Map<string, { id: string; name: string }[]>): MemberListItemDto {
    const profile = profilesById.get(row.id);
    const initials =
      profile?.initials ?? `${(profile?.first_name ?? '?')[0]}${(profile?.last_name ?? '?')[0]}`.toUpperCase();

    return {
      id: row.id,
      name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown member',
      initials,
      headline: row.headline,
      firmName: row.firm_name,
      region: row.region,
      country: row.country,
      city: row.city,
      practiceAreas: servicesByMember.get(row.id) ?? [],
      isVerified: row.is_verified,
      memberTier: row.member_tier,
      yearsOfExperience: row.years_of_experience,
      rateMinCents: row.rate_min_cents,
      rateMaxCents: row.rate_max_cents,
      rateCurrency: row.rate_currency,
      photoUrl: row.photo_url ?? profile?.avatar_url ?? null,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toEditDto(row: any, memberName: string): MemberProfileEditDto {
    return {
      id: row.id,
      memberId: row.member_id,
      memberName,
      section: row.section,
      payload: row.payload,
      proofFileUrl: row.proof_file_url,
      proofLink: row.proof_link,
      status: row.status,
      reviewNote: row.review_note,
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
      submittedAt: row.submitted_at,
    };
  }
}
