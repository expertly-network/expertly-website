import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';
import type { ApplicationRegion, MembershipTier } from '@shared/membership-application';
import type {
  MemberAward,
  MemberCredential,
  MemberEducation,
  MemberEngagement,
  MemberKeyClient,
  MemberProfileStatus,
  MemberQualification,
  MemberTestimonial,
  MemberWorkExperience,
  RenewalPaymentStatus,
} from '@shared/member';
import { MAX_LIST_ROWS } from '../common/list-limits';

// Selects profile_id, not member_profiles' own surrogate id — profile_id is what the API
// exposes as MemberDto.id.
const MEMBER_PROFILE_COLUMNS = [
  'profile_id',
  'slug',
  'headline',
  'bio',
  'firm_name',
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
  'work_email',
  'contact_phone',
  'linkedin_url',
  'website',
  'is_verified',
  'contact_verified',
  'photo_path',
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

const PROFILE_IDENTITY_COLUMNS = [
  'id',
  'first_name',
  'last_name',
  'email',
  'avatar_url',
  'initials',
  'status',
  'deleted_at',
] as const;

// The columns PATCH /members/:id may write (owner, applied immediately).
export interface MemberSelfUpdate {
  is_available?: boolean;
  availability_notes?: string | null;
  photo_path?: string;
}

export interface MemberProfileRow {
  profile_id: string;
  slug: string;
  headline: string | null;
  bio: string | null;
  firm_name: string | null;
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
  work_email: string | null;
  contact_phone: string | null;
  linkedin_url: string | null;
  website: string | null;
  is_verified: boolean;
  contact_verified: boolean;
  // Path within the (public) application-assets bucket, same convention and same file as the
  // source application's photo_path — or a legacy/seed full external URL. Never a signed URL.
  photo_path: string | null;
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

export interface ProfileIdentityRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  initials: string | null;
  /** profiles.status — the account, as opposed to member_profiles.status (the listing). */
  status: 'active' | 'suspended' | 'deleted';
  deleted_at: string | null;
}

export interface MemberDirectoryFilters {
  q?: string;
  serviceIds?: string[];
  categoryId?: string;
  countries?: string[];
  rateMinCents?: number;
  rateMaxCents?: number;
  sort?: string;
}

export type MemberProfileUpdate = Database['public']['Tables']['member_profiles']['Update'];

@Injectable()
export class MembersRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private memberProfiles() {
    return this.supabase.db.from('member_profiles');
  }

  private memberServices() {
    return this.supabase.db.from('member_services');
  }

  private services() {
    return this.supabase.db.from('services');
  }

  private categories() {
    return this.supabase.db.from('categories');
  }

  private profiles() {
    return this.supabase.db.from('profiles');
  }

  private consultationRequests() {
    return this.supabase.db.from('consultation_requests');
  }

  // Whether `requesterId` has ever sent `memberId` a consultation request (any status) — one of
  // the rules that reveal a member's contact details (MembersService.canSeeContact).
  async hasConsultationWith(requesterId: string, memberId: string): Promise<boolean> {
    const { data, error } = await this.consultationRequests()
      .select('id')
      .eq('requester_id', requesterId)
      .eq('member_id', memberId)
      .limit(1);
    if (error) throw new InternalServerErrorException('Failed to check consultation history.');
    return (data ?? []).length > 0;
  }

  // One directory page as profile ids, in display order — see member_directory_ids()
  // (supabase/migrations/0003_functions.sql).
  async findDirectoryPageIds(
    filters: MemberDirectoryFilters,
    page: { limit: number; offset: number }
  ): Promise<{ ids: string[]; total: number }> {
    const { data, error } = await this.supabase.db.rpc('member_directory_ids', {
      // Omitted (undefined) rather than explicit null — the SQL function's params all default to
      // NULL, so these are equivalent on the wire; undefined is what the generated Args type
      // (p_q?: string, etc.) actually expects.
      p_q: filters.q ?? undefined,
      p_service_ids: filters.serviceIds?.length ? filters.serviceIds : undefined,
      p_category_id: filters.categoryId ?? undefined,
      p_countries: filters.countries?.length ? filters.countries : undefined,
      p_rate_min_cents: filters.rateMinCents ?? undefined,
      p_rate_max_cents: filters.rateMaxCents ?? undefined,
      p_sort: filters.sort ?? undefined,
      p_limit: page.limit,
      p_offset: page.offset,
    });
    if (error) throw new InternalServerErrorException('Failed to load members.');
    const rows = data ?? [];
    // total_count is the same on every row; a page past the end has no rows to read it from.
    return { ids: rows.map((r) => r.profile_id), total: Number(rows[0]?.total_count ?? 0) };
  }

  // Adds one view to today's bucket for an active profile, unless the viewer is its owner.
  async recordProfileView(slug: string, viewerId: string | null): Promise<void> {
    const { error } = await this.supabase.db.rpc('record_member_profile_view', {
      p_slug: slug,
      p_viewer_id: viewerId ?? undefined,
    });
    if (error) throw new InternalServerErrorException('Failed to record the profile view.');
  }

  // The rows for one directory page (≤ 50 ids), returned in the given order.
  async findActiveByIdsInOrder(ids: string[]): Promise<MemberProfileRow[]> {
    const { data, error } = await this.memberProfiles()
      .select(MEMBER_PROFILE_COLUMNS.join(', '))
      .eq('status', 'active')
      .in('profile_id', ids);
    if (error) throw new InternalServerErrorException('Failed to load members.');
    const byId = new Map(((data ?? []) as unknown as MemberProfileRow[]).map((r) => [r.profile_id, r]));
    return ids.flatMap((id) => byId.get(id) ?? []);
  }

  // Admin review page (GET /v1/admin/members/:id/edits) — by UUID, any status.
  async findDetailByProfileId(profileId: string): Promise<MemberProfileDetailRow | null> {
    const { data, error } = await this.memberProfiles()
      .select([...MEMBER_PROFILE_COLUMNS, ...MEMBER_DETAIL_JSONB_COLUMNS].join(', '))
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load member profile.');
    return data as unknown as MemberProfileDetailRow | null;
  }

  // Slug + photo for a batch of members — enriches the admin edit queue's rows.
  async findSlugAndPhotoByProfileIds(
    profileIds: string[]
  ): Promise<Map<string, { slug: string; photo_path: string | null }>> {
    const map = new Map<string, { slug: string; photo_path: string | null }>();
    const unique = [...new Set(profileIds)];
    if (unique.length === 0) return map;

    // Loosely typed select string: member_profiles.slug isn't in the generated Database type yet.
    const columns: string = 'profile_id, slug, photo_path';
    const { data, error } = await this.memberProfiles().select(columns).in('profile_id', unique);
    if (error) throw new InternalServerErrorException('Failed to load member summaries.');
    for (const row of (data ?? []) as unknown as { profile_id: string; slug: string; photo_path: string | null }[]) {
      map.set(row.profile_id, { slug: row.slug, photo_path: row.photo_path });
    }
    return map;
  }

  // The public profile read (GET /v1/members/:slug) looks members up by their permanent,
  // server-generated slug — the UUID stays the key for everything else.
  async findDetailBySlug(slug: string): Promise<MemberProfileDetailRow | null> {
    const { data, error } = await this.memberProfiles()
      .select([...MEMBER_PROFILE_COLUMNS, ...MEMBER_DETAIL_JSONB_COLUMNS].join(', '))
      // `.filter`, not `.eq`: member_profiles.slug isn't in the generated Database type yet (see
      // MemberProfileInsert in applications.repository.ts), and `.eq` only accepts known columns.
      .filter('slug', 'eq', slug)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load member profile.');
    return data as unknown as MemberProfileDetailRow | null;
  }

  async createSignedUploadUrl(path: string): Promise<{ signedUrl: string; path: string }> {
    const { data, error } = await this.supabase.db.storage.from('member-proofs').createSignedUploadUrl(path);
    if (error || !data) throw new InternalServerErrorException('Failed to create upload URL.');
    return data;
  }

  // photo_path holds either a bucket-relative path (real uploads, application-assets — public,
  // so this is a plain permanent URL, not signed) or a legacy/seed full external URL (e.g.
  // dev-seeded randomuser.me links) — pass those through unchanged.
  buildPhotoUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    const { data } = this.supabase.db.storage.from('application-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  async adminFindAllProfiles(): Promise<MemberProfileRow[]> {
    const { data, error } = await this.memberProfiles()
      .select(MEMBER_PROFILE_COLUMNS.join(', ') + ', status')
      .order('created_at', { ascending: false })
      .limit(MAX_LIST_ROWS);

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
    if (!updated)
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member profile not found.',
      });
    return updated as unknown as MemberProfileRow;
  }

  // Short-lived read URLs for private member-proofs objects, for the admin review page.
  // Paths that can't be signed (deleted, never uploaded) are simply absent from the result.
  async createSignedProofUrls(paths: string[], expiresInSeconds: number): Promise<Record<string, string>> {
    const unique = [...new Set(paths)];
    if (unique.length === 0) return {};
    const { data, error } = await this.supabase.db.storage
      .from('member-proofs')
      .createSignedUrls(unique, expiresInSeconds);
    if (error) throw new InternalServerErrorException('Failed to sign proof file URLs.');
    const urls: Record<string, string> = {};
    for (const entry of data ?? []) {
      if (entry.path && entry.signedUrl && !entry.error) urls[entry.path] = entry.signedUrl;
    }
    return urls;
  }

  // The first `bytes` of a member-proofs object plus its total size, without buffering the whole
  // file: a short-lived signed URL fetched with a Range header. Enough for magic-byte sniffing.
  async readProofFileHead(path: string, bytes: number): Promise<{ head: Buffer; size: number }> {
    const { data, error } = await this.supabase.db.storage.from('member-proofs').createSignedUrl(path, 60);
    if (error || !data) throw new InternalServerErrorException('Failed to read uploaded file.');
    try {
      const res = await fetch(data.signedUrl, {
        headers: { Range: `bytes=0-${bytes - 1}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      // 206: "bytes 0-4099/123456" carries the total; a server ignoring Range answers 200 with
      // Content-Length — either way, stop reading after `bytes`.
      const total = Number(res.headers.get('content-range')?.split('/')[1] ?? res.headers.get('content-length'));
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let read = 0;
      while (reader && read < bytes) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        read += value.byteLength;
      }
      await reader?.cancel();
      return { head: Buffer.concat(chunks).subarray(0, bytes), size: Number.isFinite(total) ? total : read };
    } catch {
      throw new InternalServerErrorException('Failed to read uploaded file.');
    }
  }

  // Size of a member-proofs object from its storage metadata, without downloading it. Falls back
  // to a 1-byte ranged read (Content-Range carries the total) when the metadata has no size.
  async findProofFileSize(path: string): Promise<number> {
    const { data, error } = await this.supabase.db.storage.from('member-proofs').info(path);
    if (error || !data) throw new InternalServerErrorException('Failed to read uploaded file.');
    if (typeof data.size === 'number' && Number.isFinite(data.size)) return data.size;
    return (await this.readProofFileHead(path, 1)).size;
  }

  async downloadProofFile(path: string): Promise<Buffer> {
    const { data, error } = await this.supabase.db.storage.from('member-proofs').download(path);
    if (error || !data) throw new InternalServerErrorException('Failed to read uploaded file.');
    return Buffer.from(await data.arrayBuffer());
  }

  // Public application-assets bucket — same bucket member photos live in.
  async uploadPublicAsset(path: string, buffer: Buffer, contentType: string): Promise<void> {
    const { error } = await this.supabase.db.storage
      .from('application-assets')
      .upload(path, buffer, { contentType, upsert: false });
    if (error) throw new InternalServerErrorException('Failed to store client logo.');
  }

  // PATCH /members/:id — the owner's directly-editable columns.
  async updateOwnFields(memberId: string, patch: MemberSelfUpdate): Promise<void> {
    const { data, error } = await this.memberProfiles()
      .update(patch)
      .eq('profile_id', memberId)
      .select('profile_id')
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to update member profile.');
    if (!data)
      throw new NotFoundException({
        code: 'MEMBER_NOT_FOUND',
        message: 'Member profile not found.',
      });
  }

  async applyHeadlineBioEdit(memberId: string, headline: string, bio: string): Promise<void> {
    const { error } = await this.memberProfiles().update({ headline, bio }).eq('profile_id', memberId);
    if (error) throw new InternalServerErrorException('Failed to apply headline/bio edit.');
  }

  // Live contact save (2026-11-15). The personal contact_email is no longer collected, so it is
  // left untouched. `contactVerified` is false whenever a field changed.
  async applyContactLive(
    memberId: string,
    contact: {
      workEmail: string | null;
      contactPhone: string | null;
      linkedinUrl: string | null;
      website: string | null;
    },
    contactVerified: boolean
  ): Promise<void> {
    const { error } = await this.memberProfiles()
      .update({
        work_email: contact.workEmail,
        contact_phone: contact.contactPhone,
        linkedin_url: contact.linkedinUrl,
        website: contact.website,
        contact_verified: contactVerified,
      })
      .eq('profile_id', memberId);
    if (error) throw new InternalServerErrorException('Failed to save contact information.');
  }

  async setContactVerified(memberId: string, verified: boolean): Promise<void> {
    const { data, error } = await this.memberProfiles()
      .update({ contact_verified: verified })
      .eq('profile_id', memberId)
      .select('profile_id')
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to update contact verification.');
    if (!data) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member profile not found.' });
  }

  /** The admin's whole-profile "GrowXQ Verified" decision (independent of the per-entry ticks). */
  async setProfileVerified(memberId: string, verified: boolean): Promise<void> {
    const { data, error } = await this.memberProfiles()
      .update({ is_verified: verified })
      .eq('profile_id', memberId)
      .select('profile_id')
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to update profile verification.');
    if (!data) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member profile not found.' });
  }

  // Every active member's verifiable sections, for the admin's "what needs verifying" list.
  async findAllForVerification(): Promise<MemberProfileDetailRow[]> {
    const { data, error } = await this.memberProfiles()
      .select([...MEMBER_PROFILE_COLUMNS, ...MEMBER_DETAIL_JSONB_COLUMNS].join(', '))
      .eq('status', 'active')
      .limit(MAX_LIST_ROWS);
    if (error) throw new InternalServerErrorException('Failed to load members for verification.');
    return data as unknown as MemberProfileDetailRow[];
  }

  async applySectionEdit(
    memberId: string,
    column: string,
    section: string,
    items: Record<string, unknown>[]
  ): Promise<void> {
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

  async findMemberServicesByMemberIds(
    memberIds: string[]
  ): Promise<Map<string, { id: string; name: string; categoryId: string; categoryName: string }[]>> {
    const map = new Map<string, { id: string; name: string; categoryId: string; categoryName: string }[]>();
    if (memberIds.length === 0) return map;

    const { data: links, error } = await this.memberServices()
      .select('member_id, service_id')
      .in('member_id', memberIds);
    if (error) throw new InternalServerErrorException('Failed to load member services.');

    const serviceIds = [...new Set((links ?? []).map((l) => l.service_id as string))];
    const serviceById = new Map<string, { name: string; categoryId: string }>();
    if (serviceIds.length > 0) {
      const { data: services, error: servicesError } = await this.services()
        .select('id, name, category_id')
        .in('id', serviceIds);
      if (servicesError) throw new InternalServerErrorException('Failed to load member services.');
      for (const s of services ?? [])
        serviceById.set(s.id as string, { name: s.name as string, categoryId: s.category_id as string });
    }

    const categoryIds = [...new Set([...serviceById.values()].map((s) => s.categoryId))];
    const categoryNameById = new Map<string, string>();
    if (categoryIds.length > 0) {
      const { data: categories, error: categoriesError } = await this.categories()
        .select('id, name')
        .in('id', categoryIds);
      if (categoriesError) throw new InternalServerErrorException('Failed to load service categories.');
      for (const c of categories ?? []) categoryNameById.set(c.id as string, c.name as string);
    }

    for (const link of links ?? []) {
      const memberId = link.member_id as string;
      const serviceId = link.service_id as string;
      const service = serviceById.get(serviceId);
      const list = map.get(memberId) ?? [];
      list.push({
        id: serviceId,
        name: service?.name ?? 'Unknown',
        categoryId: service?.categoryId ?? '',
        categoryName: service ? (categoryNameById.get(service.categoryId) ?? 'Unknown') : 'Unknown',
      });
      map.set(memberId, list);
    }
    return map;
  }
}
