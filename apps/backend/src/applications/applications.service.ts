import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  AdminApplicationListItemDto,
  ApplicationDocumentDto,
  ApplicationDto,
  ApplicationStatus,
  BillingPeriod,
  ServicePreference,
} from '@shared/membership-application';
import { randomUUID } from 'node:crypto';
import { fromBuffer as sniffFileType } from 'file-type';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { computeTier, MEMBERSHIP_PRICE_CENTS } from './constants/pricing';
import { applyCoupon } from './constants/coupons';
import { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import { ApplicationsRepository, type ApplicationRow } from './applications.repository';

type UploadKind = 'photo' | 'document';

const ALLOWED_MIME: Record<UploadKind, string[]> = {
  photo: ['image/jpeg', 'image/png'],
  document: ['image/jpeg', 'image/png', 'application/pdf'],
};
const MAX_BYTES: Record<UploadKind, number> = {
  photo: 5 * 1024 * 1024,
  document: 15 * 1024 * 1024,
};

// Columns a draft's save-on-advance write is allowed to touch, mapped to their DTO key.
const WRITABLE_COLUMNS: Record<string, keyof UpdateApplicationDto> = {
  first_name: 'firstName',
  last_name: 'lastName',
  contact_email: 'contactEmail',
  phone_country_code: 'phoneCountryCode',
  phone: 'phone',
  region: 'region',
  country: 'country',
  state: 'state',
  city: 'city',
  linkedin_url: 'linkedinUrl',
  bio: 'bio',
  years_of_experience: 'yearsOfExperience',
  work_experiences: 'workExperiences',
  educations: 'educations',
  peer_references: 'peerReferences',
  service_preferences: 'servicePreferences',
  rate_min_cents: 'rateMinCents',
  rate_max_cents: 'rateMaxCents',
  billing_period: 'billingPeriod',
  coupon_code: 'couponCode',
  linkedin_import_consent: 'linkedinImportConsent',
  terms_version_agreed: 'termsVersionAgreed',
  privacy_version_agreed: 'privacyVersionAgreed',
  background_check_consent: 'backgroundCheckConsent',
  current_step: 'currentStep',
};

const REQUIRED_TO_SUBMIT: [string, string][] = [
  ['first_name', 'firstName'],
  ['last_name', 'lastName'],
  ['contact_email', 'contactEmail'],
  ['region', 'region'],
  ['country', 'country'],
  ['linkedin_url', 'linkedinUrl'],
  ['bio', 'bio'],
  ['years_of_experience', 'yearsOfExperience'],
  ['rate_min_cents', 'rateMinCents'],
  ['rate_max_cents', 'rateMaxCents'],
  ['billing_period', 'billingPeriod'],
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly applicationsRepository: ApplicationsRepository,
    private readonly linkedInImportProvider: LinkedInImportProvider
  ) {}

  async saveOrSubmit(user: AuthenticatedUser, dto: UpdateApplicationDto): Promise<ApplicationDto> {
    // This endpoint is for client accounts specifically, not client-or-higher.
    if (user.role !== 'client') {
      throw new ForbiddenException('Only client accounts can manage a membership application.');
    }

    const latest = await this.applicationsRepository.findLatestByApplicant(user.id);

    if (latest && ['submitted', 'under_review', 'approved'].includes(latest.status)) {
      throw new ConflictException('You already have an application in progress or decided.');
    }

    // A rejected application isn't reused — a new application starts a fresh row.
    const existing = latest && latest.status === 'draft' ? latest : null;

    const patch: Row = {};
    for (const [column, key] of Object.entries(WRITABLE_COLUMNS)) {
      const value = dto[key];
      if (value !== undefined) patch[column] = value;
    }

    const merged: Row = { ...(existing ?? { status: 'draft' }), ...patch };

    if (
      merged.rate_min_cents != null &&
      merged.rate_max_cents != null &&
      merged.rate_max_cents <= merged.rate_min_cents
    ) {
      throw new BadRequestException('rateMaxCents must be greater than rateMinCents.');
    }

    // Validates practiceAreaIds only when this call touches service_preferences.
    let practiceAreaById = new Map<string, string>();
    if (dto.servicePreferences !== undefined) {
      practiceAreaById = await this.assertActiveAndResolve(dto.servicePreferences);
    }

    if (dto.status === 'submitted') {
      this.assertComplete(merged);

      const selectedTier = computeTier(merged.years_of_experience);
      const listPriceCents = MEMBERSHIP_PRICE_CENTS[merged.billing_period as BillingPeriod];
      const couponResult = applyCoupon(merged.coupon_code, listPriceCents);
      if (!couponResult.valid) throw new BadRequestException('Invalid or expired coupon code.');

      const discountAmountCents = couponResult.discountAmountCents;
      const amountDueCents = Math.max(0, listPriceCents - discountAmountCents);

      patch.status = 'submitted';
      patch.selected_tier = selectedTier;
      patch.list_price_cents = listPriceCents;
      patch.discount_amount_cents = discountAmountCents;
      patch.amount_due_cents = amountDueCents;
      patch.payment_status = amountDueCents === 0 ? 'waived' : 'pending';
    }

    const saved = existing
      ? await this.applicationsRepository.updateById(existing.id, patch)
      : await this.applicationsRepository.insert({ ...patch, applicant_id: user.id });

    // Resolve names from the saved row when this call didn't touch service_preferences.
    if (dto.servicePreferences === undefined) {
      practiceAreaById = await this.resolvePracticeAreaNames(saved.service_preferences ?? []);
    }

    return this.toDto(saved, practiceAreaById);
  }

  async findMine(userId: string): Promise<ApplicationDto> {
    const data = await this.applicationsRepository.findLatestByApplicant(userId);
    if (!data) throw new NotFoundException('No application found for this account.');

    const practiceAreaById = await this.resolvePracticeAreaNames(data.service_preferences ?? []);
    return this.toDto(data, practiceAreaById);
  }

  async importFromLinkedIn(linkedinUrl: string) {
    return this.linkedInImportProvider.importProfile(linkedinUrl);
  }

  // Proxies the file through the backend so its MIME type can be validated from magic bytes.
  async uploadFile(
    user: AuthenticatedUser,
    kind: UploadKind,
    file: { buffer: Buffer; size: number; originalname: string }
  ): Promise<ApplicationDto> {
    if (file.size > MAX_BYTES[kind]) {
      throw new BadRequestException(`File too large — max ${MAX_BYTES[kind] / 1024 / 1024}MB for ${kind}.`);
    }

    const sniffed = await sniffFileType(file.buffer);
    if (!sniffed || !ALLOWED_MIME[kind].includes(sniffed.mime)) {
      throw new BadRequestException(`Unsupported file type for ${kind}.`);
    }

    const existing = await this.applicationsRepository.findLatestForUpload(user.id);
    if (!existing || existing.status !== 'draft') {
      throw new BadRequestException('No draft application to attach this file to.');
    }

    const existingDocuments = (existing.documents ?? []) as Row[];
    const path =
      kind === 'photo'
        ? `members/application/${user.id}/profile-photo.${sniffed.ext}`
        : `members/application/${user.id}/document-${existingDocuments.length + 1}.${sniffed.ext}`;

    await this.applicationsRepository.uploadFile(path, file.buffer, sniffed.mime);

    const patch: Row =
      kind === 'photo'
        ? { photo_path: path }
        : {
            documents: [
              ...existingDocuments,
              {
                id: randomUUID(),
                filename: file.originalname,
                path,
                mimeType: sniffed.mime,
                sizeBytes: file.size,
                uploadedAt: new Date().toISOString(),
              },
            ],
          };

    const saved = await this.applicationsRepository.saveUploadReference(existing.id, patch);

    const practiceAreaById = await this.resolvePracticeAreaNames(saved.service_preferences ?? []);
    return this.toDto(saved, practiceAreaById);
  }

  // 🛡️ manageApplications — defaults to the two reviewable statuses (submitted, under_review).
  async listForReview(status?: ApplicationStatus): Promise<AdminApplicationListItemDto[]> {
    return this.applicationsRepository.listForReview(status);
  }

  // Approves or rejects a submitted application, provisioning a member profile on approval.
  async reviewApplication(
    applicationId: string,
    reviewer: AuthenticatedUser,
    dto: ReviewApplicationDto
  ): Promise<{ status: 'approved' | 'rejected' }> {
    const application = await this.applicationsRepository.findByIdForReview(applicationId);
    if (!['submitted', 'under_review'].includes(application.status)) {
      throw new ConflictException('Only a submitted or under-review application can be reviewed.');
    }
    if (dto.status === 'rejected' && !dto.rejectionReason) {
      throw new BadRequestException('rejectionReason is required when rejecting.');
    }

    const reviewedAt = new Date().toISOString();

    if (dto.status === 'rejected') {
      await this.applicationsRepository.applyRejection(applicationId, {
        status: 'rejected',
        reviewed_by: reviewer.id,
        reviewed_at: reviewedAt,
        rejection_reason: dto.rejectionReason,
      });
      return { status: 'rejected' };
    }

    const photoUrl = application.photo_path ? await this.applicationsRepository.createSignedUrl(application.photo_path) : null;

    await this.applicationsRepository.insertMemberProfile({
      profile_id: application.applicant_id,
      bio: application.bio,
      region: application.region,
      country: application.country,
      state: application.state,
      city: application.city,
      years_of_experience: application.years_of_experience,
      rate_min_cents: application.rate_min_cents,
      rate_max_cents: application.rate_max_cents,
      member_tier: application.selected_tier,
      contact_email: application.contact_email,
      linkedin_url: application.linkedin_url,
      photo_url: photoUrl,
      application_id: application.id,
      is_verified: true,
      status: 'active',
    });

    const servicePreferences = (application.service_preferences ?? []) as { practiceAreaId: string }[];
    if (servicePreferences.length > 0) {
      await this.applicationsRepository.insertMemberServices(
        servicePreferences.map((p) => ({
          member_id: application.applicant_id,
          practice_area_id: p.practiceAreaId,
        }))
      );
    }

    await this.applicationsRepository.promoteToMember(application.applicant_id);
    await this.applicationsRepository.markApproved(applicationId, reviewer.id, reviewedAt);

    return { status: 'approved' };
  }

  private async resolvePracticeAreaNames(servicePreferences: { practiceAreaId: string }[]): Promise<Map<string, string>> {
    if (servicePreferences.length === 0) return new Map();
    return this.applicationsRepository.findPracticeAreaNames(servicePreferences.map((p) => p.practiceAreaId));
  }

  // Resolves names and rejects any id that isn't a currently-active practice area.
  private async assertActiveAndResolve(servicePreferences: { practiceAreaId: string }[]): Promise<Map<string, string>> {
    if (servicePreferences.length === 0) return new Map();

    const ids = servicePreferences.map((p) => p.practiceAreaId);
    const practiceAreaById = await this.applicationsRepository.findActivePracticeAreaNames(ids);

    const invalidIds = ids.filter((id) => !practiceAreaById.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid or inactive practice area id(s): ${invalidIds.join(', ')}`);
    }
    return practiceAreaById;
  }

  private assertComplete(row: Row) {
    const missing = REQUIRED_TO_SUBMIT.filter(([column]) => row[column] === null || row[column] === undefined).map(
      ([, key]) => key
    );

    const workExperiences = (row.work_experiences ?? []) as unknown[];
    const educations = (row.educations ?? []) as unknown[];
    const peerReferences = (row.peer_references ?? []) as unknown[];
    const servicePreferences = (row.service_preferences ?? []) as unknown[];
    if (workExperiences.length < 1) missing.push('workExperiences');
    if (educations.length < 1) missing.push('educations');
    if (peerReferences.length !== 2) missing.push('peerReferences (exactly 2 required)');
    if (servicePreferences.length < 1) missing.push('servicePreferences');
    if (row.background_check_consent !== true) missing.push('backgroundCheckConsent must be true');
    if (!row.terms_version_agreed) missing.push('termsVersionAgreed');
    if (!row.privacy_version_agreed) missing.push('privacyVersionAgreed');

    if (missing.length > 0) {
      throw new BadRequestException(`Cannot submit — missing or invalid: ${missing.join(', ')}`);
    }
  }

  private async resolveDocuments(documents: Row[]): Promise<ApplicationDocumentDto[]> {
    return Promise.all(
      documents.map(async (doc) => ({
        id: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        url: (await this.applicationsRepository.createSignedUrl(doc.path)) ?? '',
        uploadedAt: doc.uploadedAt,
      }))
    );
  }

  private async toDto(row: ApplicationRow, practiceAreaById: Map<string, string>): Promise<ApplicationDto> {
    const servicePreferences: ServicePreference[] = (row.service_preferences ?? []).map(
      (p: { practiceAreaId: string; priority: 1 | 2 | 3 }) => ({
        practiceAreaId: p.practiceAreaId,
        priority: p.priority,
        practiceAreaName: practiceAreaById.get(p.practiceAreaId) ?? 'Unknown',
      })
    );

    return {
      id: row.id,
      status: row.status,
      currentStep: row.current_step,
      photoUrl: row.photo_path ? await this.applicationsRepository.createSignedUrl(row.photo_path) : null,
      documents: await this.resolveDocuments(row.documents ?? []),
      firstName: row.first_name,
      lastName: row.last_name,
      contactEmail: row.contact_email,
      phoneCountryCode: row.phone_country_code,
      phone: row.phone,
      region: row.region,
      country: row.country,
      state: row.state,
      city: row.city,
      linkedinUrl: row.linkedin_url,
      bio: row.bio,
      yearsOfExperience: row.years_of_experience,
      workExperiences: row.work_experiences ?? [],
      educations: row.educations ?? [],
      peerReferences: row.peer_references ?? [],
      servicePreferences,
      rateMinCents: row.rate_min_cents,
      rateMaxCents: row.rate_max_cents,
      selectedTier: row.selected_tier,
      billingPeriod: row.billing_period,
      listPriceCents: row.list_price_cents,
      couponCode: row.coupon_code,
      discountAmountCents: row.discount_amount_cents,
      amountDueCents: row.amount_due_cents,
      paymentStatus: row.payment_status,
      createdAt: row.created_at,
    };
  }
}
