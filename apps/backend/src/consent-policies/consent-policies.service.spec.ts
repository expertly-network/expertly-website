import { describe, expect, it, vi, type Mock } from 'vitest';
import type { ActiveConsentPolicyRow, ConsentPoliciesRepository } from './consent-policies.repository';
import { ConsentPoliciesService } from './consent-policies.service';

type RepoMock = { [K in keyof ConsentPoliciesRepository]: Mock };

function setup() {
  const repo = { findActiveBySlug: vi.fn(), findActiveBySlugs: vi.fn(), signFile: vi.fn() } as unknown as RepoMock;
  const service = new ConsentPoliciesService(repo as unknown as ConsentPoliciesRepository);
  return { service, repo };
}

function activeRow(overrides: Partial<ActiveConsentPolicyRow> = {}): ActiveConsentPolicyRow {
  return {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    version_id: '1.0',
    file_path: 'GrowXQ - Privacy_Policy.pdf',
    ...overrides,
  };
}

describe('ConsentPoliciesService.getContentUrl', () => {
  it('returns a signed url for the active row', async () => {
    const { service, repo } = setup();
    repo.findActiveBySlug.mockResolvedValue(activeRow());
    repo.signFile.mockResolvedValue('https://signed.example/privacy.pdf');

    const result = await service.getContentUrl('privacy-policy');

    expect(repo.signFile).toHaveBeenCalledWith('GrowXQ - Privacy_Policy.pdf');
    expect(result).toEqual({ contentUrl: 'https://signed.example/privacy.pdf' });
  });

  it('throws 404 for a slug with no active row', async () => {
    const { service, repo } = setup();
    repo.findActiveBySlug.mockResolvedValue(null);

    const error = await service.getContentUrl('made-up-slug').catch((e) => e);

    expect(error.getStatus()).toBe(404);
    expect(repo.signFile).not.toHaveBeenCalled();
  });
});

describe('ConsentPoliciesService.getActiveVersionIds', () => {
  it('resolves multiple slugs in one call, keyed by slug', async () => {
    const { service, repo } = setup();
    repo.findActiveBySlugs.mockResolvedValue([
      activeRow({ slug: 'user-agreement', version_id: '1.0' }),
      activeRow({ slug: 'privacy-policy', version_id: '2.0' }),
    ]);

    const result = await service.getActiveVersionIds(['user-agreement', 'privacy-policy', 'cookie-policy']);

    expect(repo.findActiveBySlugs).toHaveBeenCalledWith(['user-agreement', 'privacy-policy', 'cookie-policy']);
    expect(result).toEqual({ 'user-agreement': '1.0', 'privacy-policy': '2.0' });
  });

  it('omits a slug with no active row entirely (not an error, not null)', async () => {
    const { service, repo } = setup();
    repo.findActiveBySlugs.mockResolvedValue([]);

    expect(await service.getActiveVersionIds(['made-up-slug'])).toEqual({});
  });
});
