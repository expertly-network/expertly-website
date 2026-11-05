import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';

// Private bucket — the 4 consent PDFs, uploaded by hand (no admin UI for this yet).
const CONSENT_BUCKET = 'User-Aggrement';
const SIGNED_URL_EXPIRES_IN_SECONDS = 300;

const CONSENT_POLICY_COLUMNS = ['slug', 'title', 'version_id', 'file_path'] as const;

export interface ActiveConsentPolicyRow {
  slug: string;
  title: string;
  version_id: string;
  file_path: string;
}

@Injectable()
export class ConsentPoliciesRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private consentPolicies() {
    return this.supabase.db.from('consent_policies');
  }

  async findActiveBySlug(slug: string): Promise<ActiveConsentPolicyRow | null> {
    const { data, error } = await this.consentPolicies()
      .select(CONSENT_POLICY_COLUMNS.join(','))
      .eq('slug', slug)
      .eq('status', 'active')
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load consent policy.');
    return data as unknown as ActiveConsentPolicyRow | null;
  }

  // One query for several slugs at once — used when an application submission resolves multiple
  // consent versions in the same request, instead of one round-trip per slug.
  async findActiveBySlugs(slugs: string[]): Promise<ActiveConsentPolicyRow[]> {
    if (slugs.length === 0) return [];
    const { data, error } = await this.consentPolicies()
      .select(CONSENT_POLICY_COLUMNS.join(','))
      .in('slug', slugs)
      .eq('status', 'active');
    if (error) throw new InternalServerErrorException('Failed to load consent policies.');
    return (data ?? []) as unknown as ActiveConsentPolicyRow[];
  }

  // Short-lived signed URL, no `download` option — the browser displays the PDF inline in a new
  // tab instead of downloading it. The file path always comes from the row above — the caller's
  // slug string is only ever used as a lookup key, never built into a path directly.
  async signFile(fileName: string): Promise<string> {
    const { data, error } = await this.supabase.db.storage
      .from(CONSENT_BUCKET)
      .createSignedUrl(fileName, SIGNED_URL_EXPIRES_IN_SECONDS);
    if (error || !data?.signedUrl) throw new InternalServerErrorException('Failed to prepare consent policy content.');
    return data.signedUrl;
  }
}
