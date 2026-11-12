import { describe, expect, it, vi } from 'vitest';
import { ApplicationsService } from './applications.service';
import type { ApplicationsRepository, ApplicationRow } from './applications.repository';
import type { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import type { ConsentPoliciesService } from '../consent-policies/consent-policies.service';
import type { EmailService } from '../email/email.service';

vi.mock('../config/env', () => ({ env: () => ({}) }));

// Smallest valid PNG header, enough for magic-byte sniffing.
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489', 'hex');

function setup(status = 'submitted') {
  const application = {
    id: 'app-1',
    applicant_id: 'user-1',
    status,
    photo_path: 'members/application/user-1/profile-photo',
    service_preferences: [],
    documents: [],
    updated_at: '2026-11-12T00:00:00Z',
  } as unknown as ApplicationRow;
  const repo = {
    findByIdForReview: vi.fn().mockResolvedValue(application),
    uploadPhoto: vi.fn().mockResolvedValue(undefined),
    setPhotoForReview: vi.fn(async () => ({ ...application, updated_at: '2026-11-12T01:00:00Z' })),
    findServiceDetails: vi.fn().mockResolvedValue(new Map()),
    createSignedDocumentUrls: vi.fn().mockResolvedValue({}),
    getPublicUrl: vi.fn((path: string) => `https://cdn.example/${path}`),
  };
  const service = new ApplicationsService(
    repo as unknown as ApplicationsRepository,
    {} as LinkedInImportProvider,
    {} as ConsentPoliciesService,
    {} as EmailService
  );
  return { repo, service };
}

describe('replacePhotoForReview', () => {
  it("overwrites the applicant's photo and bumps the row so the URL changes", async () => {
    const { repo, service } = setup();
    const dto = await service.replacePhotoForReview('app-1', { buffer: PNG, size: PNG.length, originalname: 'a.png' });
    expect(repo.uploadPhoto).toHaveBeenCalledWith('members/application/user-1/profile-photo', PNG, 'image/png');
    expect(repo.setPhotoForReview).toHaveBeenCalledWith('app-1', 'members/application/user-1/profile-photo');
    expect(dto.photoUrl).toContain('?v=2026-11-12T01%3A00%3A00Z');
  });

  it('refuses an application that is not awaiting review', async () => {
    const { repo, service } = setup('approved');
    await expect(
      service.replacePhotoForReview('app-1', { buffer: PNG, size: PNG.length, originalname: 'a.png' })
    ).rejects.toMatchObject({ response: { code: 'APPLICATION_NOT_REVIEWABLE' } });
    expect(repo.uploadPhoto).not.toHaveBeenCalled();
  });

  it('rejects a file that is not an image', async () => {
    const { repo, service } = setup();
    const text = Buffer.from('not an image at all');
    await expect(
      service.replacePhotoForReview('app-1', { buffer: text, size: text.length, originalname: 'a.png' })
    ).rejects.toMatchObject({ response: { code: 'FILE_INVALID_TYPE' } });
    expect(repo.uploadPhoto).not.toHaveBeenCalled();
  });
});
