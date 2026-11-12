import { describe, expect, it, vi } from 'vitest';
import { ApplicationsService } from './applications.service';
import type { ApplicationsRepository, ApplicationRow, ServiceDetail } from './applications.repository';
import type { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import type { ConsentPoliciesService } from '../consent-policies/consent-policies.service';
import type { EmailService } from '../email/email.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type { ReviewApplicationDto } from './dto/review-application.dto';

vi.mock('../config/env', () => ({ env: () => ({}) }));

const admin = { id: 'admin-1', role: 'admin' } as AuthenticatedUser;

const detail = (over: Partial<ServiceDetail> = {}): ServiceDetail => ({
  name: 'Benchmarking',
  categoryId: 'c1',
  categoryName: 'Transfer Pricing',
  serviceLineId: 'l1',
  serviceLineName: 'Tax',
  isCustom: false,
  isActive: true,
  ...over,
});

function setup(rowOver: Partial<ApplicationRow> = {}, services: Record<string, ServiceDetail> = {}) {
  const application = {
    id: 'app-1',
    applicant_id: 'user-1',
    status: 'submitted',
    first_name: 'Alex',
    last_name: 'Morgan',
    contact_email: 'alex@example.com',
    work_email: 'old@work.example',
    phone_country_code: '+91',
    phone: '9876543210',
    region: 'south_asia',
    country: 'India',
    state: 'Karnataka',
    city: 'Bengaluru',
    linkedin_url: null,
    bio: 'Bio',
    years_of_experience: 10,
    selected_tier: 'budding_entrepreneur',
    rate_min_cents: 2000,
    rate_max_cents: 10000,
    work_experiences: [{ title: 'Partner', company: 'Firm', startYear: 2020, isCurrent: true }],
    educations: [{ institution: 'Uni', degree: 'LLB' }],
    service_preferences: [{ serviceId: 'pref-1', priority: 1, customLabel: 'GST' }],
    photo_path: null,
    ...rowOver,
  } as unknown as ApplicationRow;
  const repo = {
    findByIdForReview: vi.fn().mockResolvedValue(application),
    claimForDecision: vi.fn().mockResolvedValue(true),
    findUniqueMemberSlug: vi.fn().mockResolvedValue('alex-morgan'),
    insertMemberProfile: vi.fn().mockResolvedValue(undefined),
    insertMemberServices: vi.fn().mockResolvedValue(undefined),
    promoteToMember: vi.fn().mockResolvedValue(undefined),
    deleteMemberProfile: vi.fn().mockResolvedValue(undefined),
    revertDecision: vi.fn().mockResolvedValue(undefined),
    updateById: vi.fn(),
    findServiceDetails: vi.fn(
      async (ids: string[]) => new Map(ids.filter((id) => services[id]).map((id) => [id, services[id]]))
    ),
  };
  const service = new ApplicationsService(
    repo as unknown as ApplicationsRepository,
    {} as LinkedInImportProvider,
    {} as ConsentPoliciesService,
    { enqueueAutomation: vi.fn() } as unknown as EmailService
  );
  const approve = (dto: Partial<ReviewApplicationDto>) =>
    service.reviewApplication('app-1', admin, { status: 'approved', ...dto } as ReviewApplicationDto);
  return { repo, service, approve };
}

describe('reviewApplication — approve', () => {
  it('applies overrides to the member profile and never updates the application', async () => {
    const { repo, approve } = setup({}, { 'pref-1': detail({ isCustom: true }) });
    await approve({
      approvedServiceId: 'pref-1',
      profileOverrides: { workEmail: 'new@work.example', yearsOfExperience: 14 },
    });
    const profile = repo.insertMemberProfile.mock.calls[0][0];
    expect(profile.work_email).toBe('new@work.example');
    expect(profile.years_of_experience).toBe(14);
    expect(profile.member_tier).toBe('seasoned_professional');
    expect(repo.updateById).not.toHaveBeenCalled();
    expect(repo.promoteToMember).toHaveBeenCalledWith('user-1', undefined);
  });

  it('accepts any active non-custom service and drops the custom label', async () => {
    const { repo, approve } = setup({}, { other: detail() });
    await approve({ approvedServiceId: 'other' });
    expect(repo.insertMemberServices).toHaveBeenCalledWith([
      { member_id: 'user-1', service_id: 'other', custom_label: null },
    ]);
  });

  it("carries the preference's custom label when the service is a preference", async () => {
    const { repo, approve } = setup({}, { 'pref-1': detail({ isCustom: true }) });
    await approve({ approvedServiceId: 'pref-1' });
    expect(repo.insertMemberServices.mock.calls[0][0][0].custom_label).toBe('GST');
  });

  it.each([
    ['inactive', { other: detail({ isActive: false }) }],
    ['custom, not a preference', { other: detail({ isCustom: true }) }],
    ['unknown', {}],
  ])('rejects a %s service', async (_label, services: Record<string, ServiceDetail>) => {
    const { approve } = setup({}, services);
    await expect(approve({ approvedServiceId: 'other' })).rejects.toMatchObject({
      response: { code: 'APPROVED_SERVICE_INVALID' },
    });
  });

  it('lets an override fill a missing country', async () => {
    const { repo, approve } = setup({ country: null }, { 'pref-1': detail({ isCustom: true }) });
    await approve({ approvedServiceId: 'pref-1', profileOverrides: { country: 'India' } });
    expect(repo.insertMemberProfile.mock.calls[0][0].country).toBe('India');
  });

  it('rejects a rate range whose max is not above min, before any write', async () => {
    const { repo, approve } = setup({}, { 'pref-1': detail({ isCustom: true }) });
    await expect(approve({ approvedServiceId: 'pref-1', profileOverrides: { rateMinCents: 20000 } })).rejects.toMatchObject(
      { response: { code: 'INVALID_RATE_RANGE' } }
    );
    expect(repo.claimForDecision).not.toHaveBeenCalled();
  });

  it('renames the account and slugs from the corrected name', async () => {
    const { repo, approve } = setup({}, { 'pref-1': detail({ isCustom: true }) });
    await approve({ approvedServiceId: 'pref-1', profileOverrides: { lastName: 'Morgan-Shah' } });
    expect(repo.findUniqueMemberSlug).toHaveBeenCalledWith('Alex Morgan-Shah');
    expect(repo.promoteToMember).toHaveBeenCalledWith('user-1', { firstName: 'Alex', lastName: 'Morgan-Shah' });
  });
});

describe('reviewApplication — reject', () => {
  it('refuses overrides on a rejection', async () => {
    const { service } = setup();
    await expect(
      service.reviewApplication('app-1', admin, {
        status: 'rejected',
        rejectionReason: 'No',
        profileOverrides: { bio: 'x' },
      } as ReviewApplicationDto)
    ).rejects.toMatchObject({ response: { code: 'OVERRIDES_ON_REJECT' } });
  });
});
