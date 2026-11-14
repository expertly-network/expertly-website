import { describe, expect, it, vi } from 'vitest';
import { ApplicationsService } from './applications.service';
import { ApplicationsRepository, type ApplicationRow } from './applications.repository';
import { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import { ConsentPoliciesService } from '../consent-policies/consent-policies.service';
import { EmailService } from '../email/email.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';

vi.mock('../config/env', () => ({ env: () => ({ SITE_LAUNCHED: 'true' }) }));

const user = {
  id: 'profile-1',
  email: 'alex@example.com',
  role: 'client',
  status: 'active',
  memberStatus: null,
  firstName: 'Alex',
  lastName: 'Morgan',
} satisfies AuthenticatedUser;

// A complete draft except for location, which each test sets. Mirrors a real applicant whose
// LinkedIn import brought in a country the wizard dropdown never offered.
function setup(location: Pick<ApplicationRow, 'country' | 'state' | 'city' | 'region'>) {
  const draft = {
    id: 'application-1',
    applicant_id: user.id,
    status: 'draft',
    first_name: 'Alex',
    last_name: 'Morgan',
    contact_email: user.email,
    work_email: 'jane@work.example',
    phone: '9876543210',
    ...location,
    linkedin_url: 'https://linkedin.com/in/example',
    bio: 'A professional biography.',
    years_of_experience: 10,
    rate_min_cents: 2000,
    rate_max_cents: 10000,
    billing_period: 'annual',
    terms_version_agreed: 'terms-v1',
    privacy_version_agreed: 'privacy-v1',
    work_experiences: [
      {
        title: 'Partner',
        company: 'Example',
        companyUrl: 'https://example.com',
        firmSize: '1-10',
        startYear: 2020,
        isCurrent: true,
      },
    ],
    educations: [{ institution: 'University', degree: 'Degree' }],
    service_preferences: [{ serviceId: 'service-1', priority: 1 }],
    peer_references: [
      { name: 'A', relationship: 'Peer', email: 'a@example.com' },
      { name: 'B', relationship: 'Peer', email: 'b@example.com' },
    ],
    documents: [],
  } as unknown as ApplicationRow;
  const repo = {
    findLatestByApplicant: vi.fn().mockResolvedValue(draft),
    hasLinkedInIdentity: vi.fn().mockResolvedValue(true),
    updateById: vi.fn(async (_id: string, patch: Partial<ApplicationRow>) => ({ ...draft, ...patch })),
    findServiceDetails: vi.fn().mockResolvedValue(new Map()),
    createSignedDocumentUrls: vi.fn().mockResolvedValue({}),
  };
  const consent = {
    getActiveVersionIds: vi.fn().mockResolvedValue({
      'user-agreement': 'terms-v1',
      'privacy-policy': 'privacy-v1',
      'cookie-policy': 'cookie-v1',
    }),
  };
  const email = { enqueueAutomation: vi.fn().mockResolvedValue('queued') };
  const service = new ApplicationsService(
    repo as unknown as ApplicationsRepository,
    {} as LinkedInImportProvider,
    consent as unknown as ConsentPoliciesService,
    email as unknown as EmailService
  );
  return { repo, service };
}

describe('region derivation on save/submit', () => {
  it('heals a pre-fix draft whose country was unmapped (region null) on a write that does not touch country', async () => {
    // Real case 2026-11-14: Mexico imported from LinkedIn, saved with region = null, applicant
    // then could not submit ("Location" incomplete) and could not re-pick Mexico in the dropdown.
    const { service, repo } = setup({ country: 'Mexico', state: 'Jalisco', city: 'Guadalajara', region: null });
    const result = await service.saveOrSubmit(user, { status: 'draft', bio: 'Updated bio.' });
    expect(repo.updateById).toHaveBeenCalledWith('application-1', expect.objectContaining({ region: 'latin_america' }));
    expect(result.region).toBe('latin_america');
  });

  it('lets such a draft submit once the region is derivable', async () => {
    const { service } = setup({ country: 'Sri Lanka', state: 'Western Province', city: 'Colombo', region: null });
    const result = await service.saveOrSubmit(user, {
      status: 'submitted',
      backgroundCheckConsent: true,
      country: 'Sri Lanka',
      state: 'Western Province',
      city: 'Colombo',
    });
    expect(result.status).toBe('submitted');
    expect(result.region).toBe('south_asia');
  });

  it('follows a changed country in the same write', async () => {
    const { service, repo } = setup({ country: 'India', state: null, city: null, region: 'south_asia' });
    await service.saveOrSubmit(user, { status: 'draft', country: 'Germany', state: '', city: '' });
    expect(repo.updateById).toHaveBeenCalledWith('application-1', expect.objectContaining({ region: 'europe' }));
  });

  it('keeps Other at null and still allows submission', async () => {
    const { service } = setup({ country: 'Other', state: 'Somewhere', city: 'Town', region: null });
    const result = await service.saveOrSubmit(user, { status: 'submitted', backgroundCheckConsent: true });
    expect(result.status).toBe('submitted');
    expect(result.region).toBeNull();
  });

  it('still blocks submission for an unknown non-Other country', async () => {
    const { service } = setup({ country: 'Atlantis', state: null, city: null, region: null });
    await expect(
      service.saveOrSubmit(user, { status: 'submitted', backgroundCheckConsent: true })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'APPLICATION_INCOMPLETE' }),
    });
  });
});
