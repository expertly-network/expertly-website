import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApplicationsService } from './applications.service';
import { ApplicationsRepository, type ApplicationRow } from './applications.repository';
import { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import { ConsentPoliciesService } from '../consent-policies/consent-policies.service';
import { EmailService } from '../email/email.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
vi.mock('../config/env', () => ({ env: () => ({ SITE_LAUNCHED: process.env.SITE_LAUNCHED }) }));
afterEach(() => vi.unstubAllEnvs());
const user = {
  id: 'profile-1',
  email: 'alex@example.com',
  role: 'client',
  status: 'active',
  memberStatus: null,
  firstName: 'Alex',
  lastName: 'Morgan',
} satisfies AuthenticatedUser;
function setup() {
  const draft = {
    id: 'application-1',
    applicant_id: user.id,
    status: 'draft',
    first_name: 'Alex',
    last_name: 'Morgan',
    contact_email: user.email,
    work_email: 'jane@work.example',
    phone: '9876543210',
    country: 'Other',
    state: 'Other',
    city: 'Other',
    region: null,
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
  return {
    repo,
    email,
    service: new ApplicationsService(
      repo as unknown as ApplicationsRepository,
      {} as LinkedInImportProvider,
      consent as unknown as ConsentPoliciesService,
      email as unknown as EmailService
    ),
  };
}
describe('application submission emails', () => {
  it.each([
    ['false', 'founding_application_submitted'],
    ['true', 'application_submitted'],
  ])('chooses the automation when SITE_LAUNCHED=%s', async (flag, key) => {
    vi.stubEnv('SITE_LAUNCHED', flag);
    const { service, email, repo } = setup();
    const result = await service.saveOrSubmit(user, { status: 'submitted', backgroundCheckConsent: true });
    expect(result.status).toBe('submitted');
    expect(email.enqueueAutomation).toHaveBeenCalledWith(
      key,
      { profileId: user.id, workEmail: 'jane@work.example' },
      { idempotencyKey: `${key}:application-1` }
    );
    expect(repo.updateById.mock.invocationCallOrder[0]).toBeLessThan(
      email.enqueueAutomation.mock.invocationCallOrder[0]
    );
  });
  it('keeps a saved submission successful when enqueue fails or the automation is disabled', async () => {
    const { service, email } = setup();
    email.enqueueAutomation.mockRejectedValueOnce(new Error('queue unavailable'));
    await expect(
      service.saveOrSubmit(user, { status: 'submitted', backgroundCheckConsent: true })
    ).resolves.toMatchObject({ status: 'submitted' });
    email.enqueueAutomation.mockResolvedValue('disabled');
    await expect(
      service.saveOrSubmit(user, { status: 'submitted', backgroundCheckConsent: true })
    ).resolves.toMatchObject({ status: 'submitted' });
  });
  it('does not enqueue drafts or failed database writes', async () => {
    const { service, email, repo } = setup();
    await service.saveOrSubmit(user, { status: 'draft' });
    expect(email.enqueueAutomation).not.toHaveBeenCalled();
    repo.updateById.mockRejectedValue(new Error('save failed'));
    await expect(service.saveOrSubmit(user, { status: 'submitted', backgroundCheckConsent: true })).rejects.toThrow(
      'save failed'
    );
    expect(email.enqueueAutomation).not.toHaveBeenCalled();
  });
});
