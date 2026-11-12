import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { InterviewStatus, InterviewSummaryStatus } from '@shared/interview';
import { SupabaseService } from '../auth/supabase.service';
import type { Database, Json } from '../supabase/database.types';

type InterviewUpdate = Database['public']['Tables']['member_interviews']['Update'];
type ConnectionUpdate = Database['public']['Tables']['member_interview_connections']['Update'];
import type { MemberContext } from './brain/types';
import type { TaxonomyEntry } from './brain/service-links';

const INTERVIEW_COLUMNS = [
  'id',
  'memberId:member_id',
  'status',
  'consentVersion:consent_version',
  'consentAt:consent_at',
  'elapsedSeconds:elapsed_seconds',
  'reconnectUntil:reconnect_until',
  'endedAt:ended_at',
  'plan',
  'state',
  'stateVersion:state_version',
  'drafts',
  'ledger',
  'audioOptIn:audio_opt_in',
  'verifiedAt:verified_at',
  'llmUsage:llm_usage',
  'summary',
  'summaryStatus:summary_status',
  'extractAttempts:extract_attempts',
  'extractClaimedAt:extract_claimed_at',
  'failureReason:failure_reason',
  'createdAt:created_at',
  'updatedAt:updated_at',
].join(', ');

const CONNECTION_COLUMNS = [
  'id',
  'interviewId:interview_id',
  'sessionTokenExpiresAt:session_token_expires_at',
  'elevenlabsConversationId:elevenlabs_conversation_id',
  'startedAt:started_at',
  'endedAt:ended_at',
  'durationSeconds:duration_seconds',
  'transcript',
  'audioPath:audio_path',
  'transcriptReceivedAt:transcript_received_at',
  'audioReceivedAt:audio_received_at',
].join(', ');

const AUDIO_BUCKET = 'interview-audio';
const OTHER_PLACEHOLDER = /^other \(please/i;
// Never sent to an LLM: private proof paths and third-party client emails.
const PRIVATE_ITEM_KEYS = new Set([
  'proofAttachments',
  'clientEmail',
  'verificationMethods',
  'verificationMethodOther',
]);

const INTERVIEW_PATCH_COLUMNS: Record<string, string> = {
  status: 'status',
  elapsedSeconds: 'elapsed_seconds',
  reconnectUntil: 'reconnect_until',
  endedAt: 'ended_at',
  plan: 'plan',
  state: 'state',
  drafts: 'drafts',
  ledger: 'ledger',
  verifiedAt: 'verified_at',
  summary: 'summary',
  summaryStatus: 'summary_status',
  extractAttempts: 'extract_attempts',
  extractClaimedAt: 'extract_claimed_at',
  failureReason: 'failure_reason',
};
const CONNECTION_PATCH_COLUMNS: Record<string, string> = {
  elevenlabsConversationId: 'elevenlabs_conversation_id',
  endedAt: 'ended_at',
  durationSeconds: 'duration_seconds',
  transcript: 'transcript',
  audioPath: 'audio_path',
  transcriptReceivedAt: 'transcript_received_at',
  audioReceivedAt: 'audio_received_at',
};

function toColumns<T>(patch: Record<string, unknown>, map: Record<string, string>): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    const column = map[key];
    if (column && value !== undefined) out[column] = value;
  }
  return out as T;
}

function dbError(message: string): InternalServerErrorException {
  return new InternalServerErrorException({ code: 'INTERVIEW_DB_ERROR', message });
}

function stripPrivate(items: unknown): unknown[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item as Record<string, unknown>).filter(([k]) => !PRIVATE_ITEM_KEYS.has(k)))
      : item
  );
}

type One<T> = T | T[];
const one = <T>(v: One<T>): T => (Array.isArray(v) ? v[0] : v);
interface ServiceLinkRow {
  service_id: string;
  custom_label: string | null;
  services: One<{ name: string; categories: One<{ name: string; service_lines: One<{ name: string }> }> }>;
}

export interface InterviewRow {
  id: string;
  memberId: string;
  status: InterviewStatus;
  consentVersion: string;
  consentAt: string;
  elapsedSeconds: number;
  reconnectUntil: string | null;
  endedAt: string | null;
  plan: unknown;
  state: unknown;
  stateVersion: number;
  drafts: unknown;
  ledger: unknown;
  audioOptIn: boolean;
  verifiedAt: string | null;
  llmUsage: unknown;
  summary: string | null;
  summaryStatus: InterviewSummaryStatus | null;
  extractAttempts: number;
  extractClaimedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ConnectionRow {
  id: string;
  interviewId: string;
  sessionTokenExpiresAt: string;
  elevenlabsConversationId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  transcript: unknown;
  audioPath: string | null;
  transcriptReceivedAt: string | null;
  audioReceivedAt: string | null;
}
export type InterviewPatch = Partial<{
  status: InterviewStatus;
  elapsedSeconds: number;
  reconnectUntil: string | null;
  endedAt: string | null;
  plan: Json;
  state: Json;
  drafts: Json | null;
  ledger: Json;
  verifiedAt: string | null;
  summary: string | null;
  summaryStatus: InterviewSummaryStatus | null;
  extractAttempts: number;
  extractClaimedAt: string | null;
  failureReason: string | null;
}>;
export type ConnectionPatch = Partial<{
  elevenlabsConversationId: string;
  endedAt: string;
  durationSeconds: number;
  transcript: Json;
  audioPath: string;
  transcriptReceivedAt: string;
  audioReceivedAt: string;
}>;

@Injectable()
export class InterviewsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private interviews() {
    return this.supabase.db.from('member_interviews');
  }
  private connections() {
    return this.supabase.db.from('member_interview_connections');
  }
  private memberProfiles() {
    return this.supabase.db.from('member_profiles');
  }
  private profiles() {
    return this.supabase.db.from('profiles');
  }
  private memberServices() {
    return this.supabase.db.from('member_services');
  }
  private audio() {
    return this.supabase.db.storage.from(AUDIO_BUCKET);
  }

  async loadMemberContext(memberId: string): Promise<MemberContext | null> {
    const [profileRes, personRes, linksRes] = await Promise.all([
      this.memberProfiles()
        .select(
          'profile_id, status, headline, bio, years_of_experience, city, country, firm_name, work_experiences, educations, engagements, key_clients'
        )
        .eq('profile_id', memberId)
        .maybeSingle(),
      this.profiles().select('first_name').eq('id', memberId).maybeSingle(),
      this.memberServices()
        .select('service_id, custom_label, services!inner(name, categories!inner(name, service_lines!inner(name)))')
        .eq('member_id', memberId),
    ]);
    if (profileRes.error) throw dbError(`member_profiles read failed: ${profileRes.error.message}`);
    if (personRes.error) throw dbError(`profiles read failed: ${personRes.error.message}`);
    if (linksRes.error) throw dbError(`member_services read failed: ${linksRes.error.message}`);
    const p = profileRes.data;
    if (!p || p.status !== 'active') return null;
    const services = ((linksRes.data ?? []) as unknown as ServiceLinkRow[]).map((l) => {
      const svc = one(l.services);
      const cat = one(svc.categories);
      const label = l.custom_label?.trim() || null;
      const service = OTHER_PLACEHOLDER.test(svc.name)
        ? (label ?? svc.name)
        : label
          ? `${svc.name} - ${label}`
          : svc.name;
      return { serviceId: l.service_id, serviceLine: one(cat.service_lines).name, category: cat.name, service };
    });
    return {
      memberId,
      firstName: personRes.data?.first_name ?? '',
      headline: p.headline,
      bio: p.bio,
      yearsOfExperience: p.years_of_experience,
      city: p.city,
      country: p.country,
      firmName: p.firm_name,
      workExperiences: stripPrivate(p.work_experiences),
      educations: stripPrivate(p.educations),
      engagements: stripPrivate(p.engagements),
      keyClients: stripPrivate(p.key_clients),
      services,
    };
  }

  /** The whole service taxonomy (id, category, service), for resolving linked-service groups. */
  async loadTaxonomy(): Promise<TaxonomyEntry[]> {
    const { data, error } = await this.supabase.db.from('services').select('id, name, categories!inner(name)');
    if (error) throw dbError(`services read failed: ${error.message}`);
    return ((data ?? []) as unknown as { id: string; name: string; categories: One<{ name: string }> }[]).map((s) => ({
      id: s.id,
      service: s.name,
      category: one(s.categories).name,
    }));
  }

  async findCurrent(memberId: string): Promise<InterviewRow | null> {
    const { data, error } = await this.interviews()
      .select(INTERVIEW_COLUMNS)
      .eq('member_id', memberId)
      .neq('status', 'voided')
      .maybeSingle();
    if (error) throw dbError(`member_interviews read failed: ${error.message}`);
    return (data as unknown as InterviewRow) ?? null;
  }

  async findById(id: string): Promise<InterviewRow | null> {
    const { data, error } = await this.interviews().select(INTERVIEW_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw dbError(`member_interviews read failed: ${error.message}`);
    return (data as unknown as InterviewRow) ?? null;
  }

  async insertInterview(input: {
    memberId: string;
    consentVersion: string;
    consentAt: string;
    audioOptIn: boolean;
  }): Promise<InterviewRow> {
    const { data, error } = await this.interviews()
      .insert({
        member_id: input.memberId,
        consent_version: input.consentVersion,
        consent_at: input.consentAt,
        audio_opt_in: input.audioOptIn,
      })
      .select(INTERVIEW_COLUMNS)
      .single();
    if (error?.code === '23505')
      throw new ConflictException({
        code: 'INTERVIEW_ALREADY_TAKEN',
        message: 'You have already taken your interview.',
      });
    if (error) throw dbError(`member_interviews insert failed: ${error.message}`);
    return data as unknown as InterviewRow;
  }

  async updateInterview(id: string, patch: InterviewPatch): Promise<InterviewRow> {
    const { data, error } = await this.interviews()
      .update(toColumns<InterviewUpdate>(patch, INTERVIEW_PATCH_COLUMNS))
      .eq('id', id)
      .select(INTERVIEW_COLUMNS)
      .single();
    if (error) throw dbError(`member_interviews update failed: ${error.message}`);
    return data as unknown as InterviewRow;
  }

  async updateStateIfVersion(id: string, state: NonNullable<Json>, expectedVersion: number): Promise<boolean> {
    const { data, error } = await this.interviews()
      .update({ state, state_version: expectedVersion + 1 })
      .eq('id', id)
      .eq('state_version', expectedVersion)
      .select('id');
    if (error) throw dbError(`member_interviews state update failed: ${error.message}`);
    return (data ?? []).length === 1;
  }

  /** Interview seconds elapsed now: finished connections plus the live one's running time. */
  async elapsedSecondsFor(interview: InterviewRow): Promise<number> {
    const live = await this.findLiveConnection(interview.id, new Date().toISOString());
    const running = live ? Math.max(0, (Date.now() - Date.parse(live.startedAt)) / 1000) : 0;
    return interview.elapsedSeconds + running;
  }

  /** Best effort: token counters must never break a turn. */
  async addLlmUsage(
    interviewId: string,
    role: string,
    usage: { input: number; output: number; cached: number }
  ): Promise<void> {
    const { error } = await this.supabase.db.rpc('interview_add_llm_usage', {
      p_interview_id: interviewId,
      p_role: role,
      p_input: usage.input,
      p_output: usage.output,
      p_cached: usage.cached,
    });
    if (error) throw dbError(`llm usage update failed: ${error.message}`);
  }

  async insertConnection(input: { interviewId: string; tokenHash: string; expiresAt: string }): Promise<ConnectionRow> {
    const { data, error } = await this.connections()
      .insert({
        interview_id: input.interviewId,
        session_token_hash: input.tokenHash,
        session_token_expires_at: input.expiresAt,
      })
      .select(CONNECTION_COLUMNS)
      .single();
    if (error) throw dbError(`connection insert failed: ${error.message}`);
    return data as unknown as ConnectionRow;
  }

  async findLiveConnection(interviewId: string, nowIso: string): Promise<ConnectionRow | null> {
    const { data, error } = await this.connections()
      .select(CONNECTION_COLUMNS)
      .eq('interview_id', interviewId)
      .is('ended_at', null)
      .gt('session_token_expires_at', nowIso)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw dbError(`connection read failed: ${error.message}`);
    return (data as unknown as ConnectionRow) ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<{ connection: ConnectionRow; interview: InterviewRow } | null> {
    const { data, error } = await this.connections()
      .select(CONNECTION_COLUMNS)
      .eq('session_token_hash', tokenHash)
      .maybeSingle();
    if (error) throw dbError(`connection read failed: ${error.message}`);
    if (!data) return null;
    const connection = data as unknown as ConnectionRow;
    const interview = await this.findById(connection.interviewId);
    return interview ? { connection, interview } : null;
  }

  async updateConnection(id: string, patch: ConnectionPatch): Promise<void> {
    const { error } = await this.connections()
      .update(toColumns<ConnectionUpdate>(patch, CONNECTION_PATCH_COLUMNS))
      .eq('id', id);
    if (error) throw dbError(`connection update failed: ${error.message}`);
  }

  async listConnections(interviewId: string): Promise<ConnectionRow[]> {
    const { data, error } = await this.connections()
      .select(CONNECTION_COLUMNS)
      .eq('interview_id', interviewId)
      .order('started_at', { ascending: true });
    if (error) throw dbError(`connection list failed: ${error.message}`);
    return (data ?? []) as unknown as ConnectionRow[];
  }

  async claimForExtraction(staleBeforeIso: string, limit: number): Promise<InterviewRow[]> {
    const { data, error } = await this.interviews()
      .select(INTERVIEW_COLUMNS)
      .eq('status', 'processing')
      .lt('extract_attempts', 5)
      .or(`extract_claimed_at.is.null,extract_claimed_at.lt.${staleBeforeIso}`)
      .order('updated_at', { ascending: true })
      .limit(limit);
    if (error) throw dbError(`extraction claim read failed: ${error.message}`);
    const claimed: InterviewRow[] = [];
    for (const row of (data ?? []) as unknown as InterviewRow[]) {
      const { data: won, error: claimError } = await this.interviews()
        .update({ extract_claimed_at: new Date().toISOString(), extract_attempts: row.extractAttempts + 1 })
        .eq('id', row.id)
        .eq('extract_attempts', row.extractAttempts)
        .select(INTERVIEW_COLUMNS);
      if (claimError) throw dbError(`extraction claim failed: ${claimError.message}`);
      if (won && won.length === 1) claimed.push(won[0] as unknown as InterviewRow);
    }
    return claimed;
  }

  async listExpiredInterruptions(nowIso: string, limit: number): Promise<InterviewRow[]> {
    const { data, error } = await this.interviews()
      .select(INTERVIEW_COLUMNS)
      .eq('status', 'interrupted')
      .lt('reconnect_until', nowIso)
      .limit(limit);
    if (error) throw dbError(`expired interruptions read failed: ${error.message}`);
    return (data ?? []) as unknown as InterviewRow[];
  }

  async uploadAudio(path: string, mp3: Buffer): Promise<void> {
    const { error } = await this.audio().upload(path, mp3, { contentType: 'audio/mpeg', upsert: true });
    if (error) throw dbError(`audio upload failed: ${error.message}`);
  }

  async signedAudioUrl(path: string, expiresInSeconds: number): Promise<string | null> {
    const { data, error } = await this.audio().createSignedUrl(path, expiresInSeconds);
    return error || !data ? null : data.signedUrl;
  }

  async adminList(input: {
    status?: InterviewStatus;
    offset: number;
    limit: number;
  }): Promise<{ rows: (InterviewRow & { memberName: string })[]; total: number }> {
    let query = this.interviews().select(INTERVIEW_COLUMNS, { count: 'exact' });
    if (input.status) query = query.eq('status', input.status);
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);
    if (error) throw dbError(`admin list failed: ${error.message}`);
    const rows = (data ?? []) as unknown as InterviewRow[];
    const names = await this.findMemberNames(rows.map((r) => r.memberId));
    return { rows: rows.map((r) => ({ ...r, memberName: names.get(r.memberId) ?? '' })), total: count ?? rows.length };
  }

  private async findMemberNames(ids: string[]): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    const { data, error } = await this.profiles()
      .select('id, first_name, last_name')
      .in('id', [...new Set(ids)]);
    if (error) throw dbError(`profiles read failed: ${error.message}`);
    return new Map((data ?? []).map((p) => [p.id, `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()]));
  }

  async findMemberName(memberId: string): Promise<string> {
    return (await this.findMemberNames([memberId])).get(memberId) ?? '';
  }

  async findMemberWorkEmail(memberId: string): Promise<string | null> {
    const { data, error } = await this.memberProfiles().select('work_email').eq('profile_id', memberId).maybeSingle();
    if (error) throw dbError(`member_profiles read failed: ${error.message}`);
    return data?.work_email ?? null;
  }

  async findProfileRole(userId: string): Promise<{ role: string; status: string } | null> {
    const { data, error } = await this.profiles().select('role, status').eq('id', userId).maybeSingle();
    if (error) throw dbError(`profiles read failed: ${error.message}`);
    return data ?? null;
  }
}
