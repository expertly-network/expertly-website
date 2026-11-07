import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { TablesInsert, TablesUpdate } from '../supabase/database.types';
import type { EmailMessageStatus } from '@shared/email';
import type { ListEmailMessagesDto } from './dto/email.dto';

const AUTOMATION_COLUMNS = ['key', 'name', 'description', 'resend_template', 'enabled', 'updated_at'] as const;
export interface AutomationRow {
  key: string;
  name: string;
  description: string | null;
  resend_template: string;
  enabled: boolean;
  updated_at: string;
}
const MESSAGE_COLUMNS = [
  'id',
  'automation_key',
  'resend_template',
  'recipient_profile_id',
  'to_email',
  'variables',
  'idempotency_key',
  'status',
  'next_attempt_at',
  'attempts',
  'claimed_at',
  'claim_count',
  'manual_retries',
  'provider_message_id',
  'last_error',
  'sent_at',
  'delivered_at',
  'created_at',
] as const;
export interface MessageRow {
  id: string;
  automation_key: string;
  resend_template: string;
  recipient_profile_id: string | null;
  to_email: string;
  variables: unknown;
  idempotency_key: string | null;
  status: EmailMessageStatus;
  next_attempt_at: string;
  attempts: number;
  claimed_at: string | null;
  claim_count: number;
  manual_retries: number;
  provider_message_id: string | null;
  last_error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
}
const PROFILE_COLUMNS = ['id', 'email', 'first_name'] as const;
export interface ProfileRow {
  id: string;
  email: string;
  first_name: string;
}
export interface RenewalRow {
  id: string;
  membership_started_at: string;
}

function check(error: { code?: string } | null): void {
  if (!error) return;
  if (error.code === '23505' || error.code === '40001')
    throw new ConflictException({ code: 'EMAIL_WRITE_CONFLICT', message: 'Email data changed. Refresh and retry.' });
  throw new InternalServerErrorException({ code: 'EMAIL_DATABASE_ERROR', message: 'Email database operation failed.' });
}

@Injectable()
export class EmailRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private messages() {
    return this.supabase.db.from('email_messages');
  }
  private automations() {
    return this.supabase.db.from('email_automations');
  }
  private profiles() {
    return this.supabase.db.from('profiles');
  }
  private suppressions() {
    return this.supabase.db.from('email_suppressions');
  }
  private members() {
    return this.supabase.db.from('member_profiles');
  }

  async listAutomations(): Promise<AutomationRow[]> {
    const { data, error } = await this.automations().select(AUTOMATION_COLUMNS.join(',')).order('key');
    check(error);
    return data as unknown as AutomationRow[];
  }
  async findAutomation(key: string): Promise<AutomationRow | null> {
    const { data, error } = await this.automations().select(AUTOMATION_COLUMNS.join(',')).eq('key', key).maybeSingle();
    check(error);
    return data as unknown as AutomationRow | null;
  }
  async updateAutomation(key: string, patch: TablesUpdate<'email_automations'>): Promise<void> {
    const { error } = await this.automations().update(patch).eq('key', key);
    check(error);
  }
  async findProfiles(ids: string[]): Promise<ProfileRow[]> {
    const rows: ProfileRow[] = [];
    for (let offset = 0; offset < ids.length; offset += 200) {
      const { data, error } = await this.profiles()
        .select(PROFILE_COLUMNS.join(','))
        .in('id', ids.slice(offset, offset + 200));
      check(error);
      rows.push(...(data as unknown as ProfileRow[]));
    }
    return rows;
  }
  // Inserts unless a message with the same idempotency key already exists; false = duplicate.
  async insertMessage(row: TablesInsert<'email_messages'>): Promise<boolean> {
    const { data, error } = await this.messages()
      .upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
      .select('id');
    check(error);
    return Boolean(data?.length);
  }
  async findExistingIdempotencyKeys(keys: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    // Chunked: the keys travel in the query string, and a 500-member renewal page would overrun it.
    for (let i = 0; i < keys.length; i += 100) {
      const { data, error } = await this.messages()
        .select('idempotency_key')
        .in('idempotency_key', keys.slice(i, i + 100));
      check(error);
      for (const r of data ?? []) if (r.idempotency_key) found.add(r.idempotency_key);
    }
    return found;
  }
  async listMessages(filter: ListEmailMessagesDto): Promise<{ rows: MessageRow[]; total: number }> {
    let query = this.messages()
      .select(MESSAGE_COLUMNS.join(','), { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id');
    if (filter.status) query = query.eq('status', filter.status);
    if (filter.automationKey) query = query.eq('automation_key', filter.automationKey);
    if (filter.email) query = query.eq('to_email', filter.email.toLowerCase());
    const { data, error, count } = await query.range(
      (filter.page - 1) * filter.pageSize,
      filter.page * filter.pageSize - 1
    );
    check(error);
    return { rows: data as unknown as MessageRow[], total: count ?? 0 };
  }
  async findMessage(id: string): Promise<MessageRow | null> {
    const { data, error } = await this.messages().select(MESSAGE_COLUMNS.join(',')).eq('id', id).maybeSingle();
    check(error);
    return data as unknown as MessageRow | null;
  }
  // Compare-and-set: applies only while the row still has expectedStatus (and, for the sender,
  // the exact lease it claimed). False = the precondition no longer held.
  async updateMessage(
    id: string,
    patch: TablesUpdate<'email_messages'>,
    expectedStatus: EmailMessageStatus,
    claimedAt?: string
  ): Promise<boolean> {
    let query = this.messages().update(patch).eq('id', id).eq('status', expectedStatus);
    if (claimedAt) query = query.eq('claimed_at', claimedAt);
    const { data, error } = await query.select('id');
    check(error);
    return Boolean(data?.length);
  }
  async claimMessages(limit: number): Promise<MessageRow[]> {
    const { data: claims, error } = await this.supabase.db.rpc('email_claim', { p_limit: limit, p_lease: '5 minutes' });
    check(error);
    if (!claims?.length) return [];
    const { data, error: readError } = await this.messages()
      .select(MESSAGE_COLUMNS.join(','))
      .in(
        'id',
        claims.map((c) => c.id)
      );
    check(readError);
    // Keep only the lease acquired by this invocation, never a newer claim.
    return (data as unknown as MessageRow[]).filter(
      (m) => claims.some((c) => c.id === m.id && c.claimed_at === m.claimed_at) && m.status === 'sending'
    );
  }
  async isSuppressed(email: string): Promise<boolean> {
    const { data, error } = await this.suppressions().select('email').eq('email', email.toLowerCase()).maybeSingle();
    check(error);
    return Boolean(data);
  }
  async applyEvent(providerId: string, status: string, suppress: boolean, at: string, email?: string): Promise<void> {
    const { error } = await this.supabase.db.rpc('email_apply_event', {
      p_provider_id: providerId,
      p_status: status,
      p_suppress: suppress,
      p_at: at,
      p_email: email,
    });
    check(error);
  }
  async renewalCandidates(afterId?: string): Promise<RenewalRow[]> {
    let query = this.members()
      .select('id:profile_id,membership_started_at')
      .eq('status', 'active')
      .or('renewal_payment_status.is.null,renewal_payment_status.neq.paid')
      .order('profile_id')
      .limit(500);
    if (afterId) query = query.gt('profile_id', afterId);
    const { data, error } = await query;
    check(error);
    return data as unknown as RenewalRow[];
  }
}
