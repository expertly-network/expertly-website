import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { Database } from '../supabase/database.types';
import type { ConsultationRequestDto } from '@shared/consultation-request';

export type ConsultationRequestInsert = Database['public']['Tables']['consultation_requests']['Insert'];

// Every column aliased to its ConsultationRequestDto camelCase name. subject/description/
// scheduled_at are deliberately excluded — unused by this feature, see the design spec §3.
// service_id/custom_service_label/response_message ARE included (added after that spec).
const CONSULTATION_COLUMNS = [
  'id',
  'requesterId:requester_id',
  'requesterName:requester_name',
  'requesterContactEmail:requester_contact_email',
  'requesterPhone:requester_phone',
  'memberId:member_id',
  'message',
  'serviceId:service_id',
  'customServiceLabel:custom_service_label',
  'status',
  'responseMessage:response_message',
  'rating',
  'createdAt:created_at',
  'updatedAt:updated_at',
] as const;

const PROFILE_ROLE_COLUMNS = ['id', 'role', 'status'] as const;
export interface ProfileRoleRow {
  id: string;
  role: 'client' | 'member' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
}

const PROFILE_IDENTITY_COLUMNS = ['id', 'avatarUrl:avatar_url', 'role', 'firstName:first_name', 'lastName:last_name'] as const;
export interface ProfileIdentityRow {
  id: string;
  avatarUrl: string | null;
  role: 'client' | 'member' | 'admin';
  firstName: string;
  lastName: string;
}

// country/city/photoPath added so enrichment can show a member's real location and photo —
// previously this card only fell back to profiles.avatar_url, which is empty for most members;
// their real photo lives on member_profiles.photo_path (see MembersRepository.buildPhotoUrl's
// comment for the same priority: photo_path first, profiles.avatar_url as fallback).
const MEMBER_FIRM_COLUMNS = [
  'profileId:profile_id',
  'firmName:firm_name',
  'headline',
  'slug',
  'country',
  'city',
  'photoPath:photo_path',
] as const;
export interface MemberFirmRow {
  profileId: string;
  firmName: string | null;
  headline: string | null;
  slug: string;
  country: string;
  city: string | null;
  photoPath: string | null;
}

const SERVICE_COLUMNS = ['id', 'name'] as const;
export interface ServiceRow {
  id: string;
  name: string;
}

const MESSAGE_COLUMNS = ['id', 'requestId:request_id', 'senderId:sender_id', 'body', 'createdAt:created_at'] as const;
export interface ConsultationMessageRow {
  id: string;
  requestId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

@Injectable()
export class ConsultationsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private consultations() {
    return this.supabase.db.from('consultation_requests');
  }

  private profiles() {
    return this.supabase.db.from('profiles');
  }

  private memberProfiles() {
    return this.supabase.db.from('member_profiles');
  }

  private memberServices() {
    return this.supabase.db.from('member_services');
  }

  private services() {
    return this.supabase.db.from('services');
  }

  private messages() {
    return this.supabase.db.from('consultation_messages');
  }

  // Same logic as MembersRepository.buildPhotoUrl — photo_path is either a bucket-relative path
  // (real uploads) or a legacy/seed full external URL, never a signed URL.
  buildPhotoUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    const { data } = this.supabase.db.storage.from('application-assets').getPublicUrl(path);
    return data.publicUrl;
  }

  async findProfileRole(id: string): Promise<ProfileRoleRow | null> {
    const { data, error } = await this.profiles()
      .select(PROFILE_ROLE_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to look up profile.');
    return data as unknown as ProfileRoleRow | null;
  }

  // Mirrors MembersRepository.findActiveList()'s `.eq('status', 'active')` filter on
  // member_profiles — a profiles.role === 'member' row can still belong to a deactivated member
  // profile, which should not be reachable for new consultation requests.
  async isMemberProfileActive(profileId: string): Promise<boolean> {
    const { data, error } = await this.memberProfiles()
      .select('profile_id')
      .eq('profile_id', profileId)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to look up member profile status.');
    return !!data;
  }

  // The composite PK on member_services (member_id, service_id) means this is a membership
  // check, not a lookup — confirms the requester's chosen service is actually one this member
  // offers, rather than trusting an arbitrary services.id the client happened to send.
  async isMemberService(memberId: string, serviceId: string): Promise<boolean> {
    const { data, error } = await this.memberServices()
      .select('service_id')
      .eq('member_id', memberId)
      .eq('service_id', serviceId)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to verify member service.');
    return !!data;
  }

  async countByRequesterSince(requesterId: string, sinceIso: string): Promise<number> {
    const { count, error } = await this.consultations()
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', requesterId)
      .gte('created_at', sinceIso);

    if (error) throw new InternalServerErrorException('Failed to check consultation request rate limit.');
    return count ?? 0;
  }

  // The most recent still-pending request this requester has sent to this specific member, if
  // any — used to block a duplicate before the member has even responded to the last one.
  // Ordered desc + limited to 1 rather than a plain exists-check so the caller can read its
  // created_at and apply the cooldown-expiry window on top.
  async findLatestPendingToMember(requesterId: string, memberId: string): Promise<{ createdAt: string } | null> {
    const { data, error } = await this.consultations()
      .select('createdAt:created_at')
      .eq('requester_id', requesterId)
      .eq('member_id', memberId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to check for an existing pending request.');
    return data as unknown as { createdAt: string } | null;
  }

  async insert(row: ConsultationRequestInsert): Promise<ConsultationRequestDto> {
    const { data: inserted, error } = await this.consultations()
      .insert(row)
      .select(CONSULTATION_COLUMNS.join(', '))
      .single();

    if (error || !inserted) throw new InternalServerErrorException('Failed to create consultation request.');
    return inserted as unknown as ConsultationRequestDto;
  }

  async findByRequesterId(requesterId: string): Promise<ConsultationRequestDto[]> {
    const { data, error } = await this.consultations()
      .select(CONSULTATION_COLUMNS.join(', '))
      .eq('requester_id', requesterId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load consultation requests.');
    return data as unknown as ConsultationRequestDto[];
  }

  async findByMemberId(memberId: string): Promise<ConsultationRequestDto[]> {
    const { data, error } = await this.consultations()
      .select(CONSULTATION_COLUMNS.join(', '))
      .eq('member_id', memberId)
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load consultation requests.');
    return data as unknown as ConsultationRequestDto[];
  }

  async findAll(): Promise<ConsultationRequestDto[]> {
    const { data, error } = await this.consultations()
      .select(CONSULTATION_COLUMNS.join(', '))
      .order('created_at', { ascending: false });

    if (error) throw new InternalServerErrorException('Failed to load consultation requests.');
    return data as unknown as ConsultationRequestDto[];
  }

  async findById(id: string): Promise<ConsultationRequestDto> {
    const { data, error } = await this.consultations()
      .select(CONSULTATION_COLUMNS.join(', '))
      .eq('id', id)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load consultation request.');
    if (!data) throw new NotFoundException('Consultation request not found.');
    return data as unknown as ConsultationRequestDto;
  }

  // Atomic conditional update: the `.eq('status', 'pending')` filter lives on the UPDATE itself,
  // not just on a prior read, so two concurrent transitions on the same row can't both succeed
  // (mirrors MembersRepository.supersedePendingEdits()'s pattern). Returns null when the row
  // existed but was no longer pending by the time this ran — the caller distinguishes that from a
  // real DB error.
  async updateStatus(
    id: string,
    status: 'completed' | 'declined',
    responseMessage: string
  ): Promise<ConsultationRequestDto | null> {
    const { data: updated, error } = await this.consultations()
      .update({ status, response_message: responseMessage })
      .eq('id', id)
      .eq('status', 'pending')
      .select(CONSULTATION_COLUMNS.join(', '))
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to update consultation request.');
    if (!updated) return null;
    return updated as unknown as ConsultationRequestDto;
  }

  // Same atomic-conditional pattern as updateStatus: the `.neq('status', 'pending')` and
  // `.eq('requester_id', ...)` filters live on the UPDATE itself. Returns null when the row
  // doesn't belong to this requester, or is still 'pending' (not yet decided) — the caller
  // distinguishes neither of those from a real DB error.
  async updateRating(id: string, requesterId: string, rating: number): Promise<ConsultationRequestDto | null> {
    const { data: updated, error } = await this.consultations()
      .update({ rating })
      .eq('id', id)
      .eq('requester_id', requesterId)
      .neq('status', 'pending')
      .select(CONSULTATION_COLUMNS.join(', '))
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to save rating.');
    if (!updated) return null;
    return updated as unknown as ConsultationRequestDto;
  }

  async findMessagesByRequestId(requestId: string): Promise<ConsultationMessageRow[]> {
    const { data, error } = await this.messages()
      .select(MESSAGE_COLUMNS.join(', '))
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) throw new InternalServerErrorException('Failed to load messages.');
    return data as unknown as ConsultationMessageRow[];
  }

  async insertMessage(requestId: string, senderId: string, body: string): Promise<ConsultationMessageRow> {
    const { data, error } = await this.messages()
      .insert({ request_id: requestId, sender_id: senderId, body })
      .select(MESSAGE_COLUMNS.join(', '))
      .single();

    if (error || !data) throw new InternalServerErrorException('Failed to post message.');
    return data as unknown as ConsultationMessageRow;
  }

  async findProfilesByIds(ids: string[]): Promise<Map<string, ProfileIdentityRow>> {
    const map = new Map<string, ProfileIdentityRow>();
    if (ids.length === 0) return map;

    const { data, error } = await this.profiles().select(PROFILE_IDENTITY_COLUMNS.join(', ')).in('id', ids);
    if (error) throw new InternalServerErrorException('Failed to load profile identities.');
    for (const p of (data ?? []) as unknown as ProfileIdentityRow[]) map.set(p.id, p);
    return map;
  }

  async findMemberFirmsByProfileIds(ids: string[]): Promise<Map<string, MemberFirmRow>> {
    const map = new Map<string, MemberFirmRow>();
    if (ids.length === 0) return map;

    const { data, error } = await this.memberProfiles().select(MEMBER_FIRM_COLUMNS.join(', ')).in('profile_id', ids);
    if (error) throw new InternalServerErrorException('Failed to load member profiles.');
    for (const m of (data ?? []) as unknown as MemberFirmRow[]) map.set(m.profileId, m);
    return map;
  }

  async findServiceNamesByIds(ids: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (ids.length === 0) return map;

    const { data, error } = await this.services().select(SERVICE_COLUMNS.join(', ')).in('id', ids);
    if (error) throw new InternalServerErrorException('Failed to load services.');
    for (const s of (data ?? []) as unknown as ServiceRow[]) map.set(s.id, s.name);
    return map;
  }
}
