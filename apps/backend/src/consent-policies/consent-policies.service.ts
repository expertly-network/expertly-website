import { Injectable, NotFoundException } from '@nestjs/common';
import type { ConsentPolicyUrlDto } from '@shared/consent-policy';
import { ConsentPoliciesRepository } from './consent-policies.repository';

@Injectable()
export class ConsentPoliciesService {
  constructor(private readonly consentPoliciesRepository: ConsentPoliciesRepository) {}

  async getContentUrl(slug: string): Promise<ConsentPolicyUrlDto> {
    const row = await this.consentPoliciesRepository.findActiveBySlug(slug);
    if (!row) throw new NotFoundException({ code: 'CONSENT_POLICY_NOT_FOUND', message: 'Consent policy not found.' });
    const contentUrl = await this.consentPoliciesRepository.signFile(row.file_path);
    return { contentUrl };
  }

  // Used at application-submission time: resolves several slugs' current active versions in one
  // query, so a client can never influence which version gets recorded as agreed-to. A slug with
  // no active row is simply absent from the result (treated as "nothing to record" by the
  // caller, not an error — a missing consent_policies row shouldn't block a submission).
  async getActiveVersionIds(slugs: string[]): Promise<Record<string, string>> {
    const rows = await this.consentPoliciesRepository.findActiveBySlugs(slugs);
    return Object.fromEntries(rows.map((row) => [row.slug, row.version_id]));
  }
}
