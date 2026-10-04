import {
  BadGatewayException,
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
  CouponPreviewResponse,
  ServicePreference,
} from '@shared/membership-application';
import { randomUUID } from 'node:crypto';
import { fromBuffer as sniffFileType } from 'file-type';
import { UpdateApplicationDto } from './dto/update-application.dto';
import { ReviewApplicationDto } from './dto/review-application.dto';
import { CouponPreviewDto } from './dto/coupon-preview.dto';
import { computeTier, MEMBERSHIP_PRICE_CENTS } from './constants/pricing';
import { applyCoupon } from './constants/coupons';
import { deriveRegion } from './constants/country-region';
import { LinkedInImportProvider } from './linkedin-import/linkedin-import.provider';
import { ApplicationsRepository, type ApplicationRow, type ServiceDetail } from './applications.repository';

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
  // region is deliberately absent: it's derived server-side from country (see saveOrSubmit),
  // never taken directly from client input.
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

    // Re-derive region whenever country is part of this write, so it never drifts out of sync
    // with whatever country the applicant last saved.
    if (patch.country !== undefined) {
      patch.region = deriveRegion(patch.country as string);
    }

    const merged: Row = { ...(existing ?? { status: 'draft' }), ...patch };

    if (
      merged.rate_min_cents != null &&
      merged.rate_max_cents != null &&
      merged.rate_max_cents <= merged.rate_min_cents
    ) {
      throw new BadRequestException('rateMaxCents must be greater than rateMinCents.');
    }

    // Validates serviceIds only when this call touches service_preferences.
    let serviceDetails = new Map<string, ServiceDetail>();
    if (dto.servicePreferences !== undefined) {
      serviceDetails = await this.assertActiveAndResolveServices(dto.servicePreferences);
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

    // Resolve details from the saved row when this call didn't touch service_preferences.
    if (dto.servicePreferences === undefined) {
      serviceDetails = await this.resolveServiceDetails(saved.service_preferences ?? []);
    }

    return this.toDto(saved, serviceDetails);
  }

  async findMine(userId: string): Promise<ApplicationDto> {
    const data = await this.applicationsRepository.findLatestByApplicant(userId);
    if (!data) throw new NotFoundException('No application found for this account.');

    const serviceDetails = await this.resolveServiceDetails(data.service_preferences ?? []);
    return this.toDto(data, serviceDetails);
  }

  async importFromLinkedIn(linkedinUrl: string) {
    return this.linkedInImportProvider.importProfile(linkedinUrl);
  }

  // Stateless — lets the review step show the real discounted price live as a coupon is typed,
  // instead of a hardcoded label that never reflects the coupon. Reuses the exact same
  // applyCoupon() logic the real submission path uses, so the two can never drift apart.
  previewCoupon(dto: CouponPreviewDto): CouponPreviewResponse {
    const listPriceCents = MEMBERSHIP_PRICE_CENTS[dto.billingPeriod];
    const couponResult = applyCoupon(dto.couponCode, listPriceCents);
    const discountAmountCents = couponResult.valid ? couponResult.discountAmountCents : 0;
    return {
      valid: couponResult.valid,
      listPriceCents,
      discountAmountCents,
      amountDueCents: Math.max(0, listPriceCents - discountAmountCents),
    };
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
    // The photo path deliberately has no extension: it must stay stable across re-uploads (the
    // upload is `upsert: true`), and baking the sniffed extension in here meant re-uploading in a
    // different format (e.g. jpg -> png) produced a second, orphaned object instead of replacing
    // the first. Content-Type is already carried by the object's metadata, not its key.
    const path =
      kind === 'photo'
        ? `members/application/${user.id}/profile-photo`
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

    const serviceDetails = await this.resolveServiceDetails(saved.service_preferences ?? []);
    return this.toDto(saved, serviceDetails);
  }

  // Best-effort: pulls the profile photo off the caller's linked LinkedIn OAuth identity and
  // stores it the same way a manual upload would. Never overwrites a photo the applicant already
  // has — callers are expected to check for that themselves before invoking this.
  async importPhotoFromLinkedIn(user: AuthenticatedUser): Promise<ApplicationDto> {
    const pictureUrl = await this.applicationsRepository.findLinkedInPictureUrl(user.id);
    if (!pictureUrl) throw new NotFoundException('No LinkedIn photo available to import.');

    const response = await fetch(pictureUrl);
    if (!response.ok) throw new BadGatewayException('Failed to fetch LinkedIn photo.');
    const buffer = Buffer.from(await response.arrayBuffer());

    return this.uploadFile(user, 'photo', { buffer, size: buffer.length, originalname: 'linkedin-photo' });
  }

  // 🛡️ manageApplications — returns every status by default; the admin table filters client-side.
  async listForReview(status?: ApplicationStatus): Promise<AdminApplicationListItemDto[]> {
    const rows = await this.applicationsRepository.listForReview(status);

    // Repository selects this column pre-aliased to camelCase (see ADMIN_LIST_COLUMNS) — unlike
    // the rest of this file's row shapes, so it's `row.servicePreferences`, not the snake_case
    // `row.service_preferences` every other query here returns.
    const allPreferences = rows.flatMap((r) => (r.servicePreferences ?? []) as { serviceId: string }[]);
    const serviceDetails = await this.resolveServiceDetails(allPreferences);

    return rows.map((row) => ({
      ...row,
      servicePreferences: this.toServicePreferences(row.servicePreferences ?? [], serviceDetails),
    })) as unknown as AdminApplicationListItemDto[];
  }

  // 🛡️ manageApplications — the exact same ApplicationDto shape the applicant sees on their own
  // review step, for the admin detail page.
  async getForReview(id: string): Promise<ApplicationDto> {
    const application = await this.applicationsRepository.findByIdForReview(id);
    const serviceDetails = await this.resolveServiceDetails(application.service_preferences ?? []);
    return this.toDto(application, serviceDetails);
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

    const submittedPreferences = (application.service_preferences ?? []) as {
      serviceId: string;
      customLabel?: string;
    }[];

    if (dto.status === 'approved') {
      if (!dto.approvedServiceId) {
        throw new BadRequestException('approvedServiceId is required when approving.');
      }
      if (!submittedPreferences.some((p) => p.serviceId === dto.approvedServiceId)) {
        throw new BadRequestException('approvedServiceId must be one of the applicant\'s submitted service preferences.');
      }
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

    const slug = await this.applicationsRepository.findUniqueMemberSlug(
      `${application.first_name} ${application.last_name}`
    );

    // Same shape assertComplete() now requires at submit time — a current (isCurrent) position
    // with a company name and company website. Older applications submitted before those checks
    // existed may still lack one; fall back to the most recent entry rather than leaving
    // firm_name silently null. firm_website has no such fallback value — member_profiles.firm_website
    // is nullable (relaxed 2026-10-03; every read path already treated it as such) precisely for
    // this case, so a pre-existing application with no companyUrl anywhere still inserts cleanly.
    const workExperiences = (application.work_experiences ?? []) as {
      title: string;
      company: string;
      companyUrl?: string;
      startYear: number;
      endYear?: number;
      isCurrent: boolean;
    }[];
    const educations = (application.educations ?? []) as {
      institution: string;
      degree: string;
      fieldOfStudy?: string;
      endYear?: number;
    }[];
    const currentJob = workExperiences.find((w) => w.isCurrent) ?? workExperiences[0];

    await this.applicationsRepository.insertMemberProfile({
      profile_id: application.applicant_id,
      slug,
      bio: application.bio,
      firm_name: currentJob?.company ?? null,
      firm_website: currentJob?.companyUrl ?? null,
      region: application.region,
      country: application.country,
      state: application.state,
      city: application.city,
      years_of_experience: application.years_of_experience,
      rate_min_cents: application.rate_min_cents,
      rate_max_cents: application.rate_max_cents,
      // Admin can override the tier computed at submission; falls back to it when omitted.
      member_tier: dto.memberTier ?? application.selected_tier,
      // Explicit rather than omitted-and-DB-defaulted, so the inserted row's start date is always
      // traceable to a value this call actually decided (the admin's input, or "now" computed
      // here) — same effective default as before, just no longer implicit.
      membership_started_at: dto.membershipStartedAt ?? new Date().toISOString(),
      contact_email: application.contact_email,
      // member_profiles.contact_phone is one field (unlike the application's split
      // phone_country_code/phone) — same join convention the frontend already uses for display.
      contact_phone: application.phone ? `${application.phone_country_code ?? ''} ${application.phone}`.trim() : null,
      linkedin_url: application.linkedin_url,
      // Member profile's work-history/education shape is simpler than the application's own
      // (id-keyed, no city/firmSize/companyUrl/startMonth/endMonth, description instead) — same
      // { id: randomUUID(), ...item } convention MembersService uses when a member's own
      // self-edit gets applied to these same jsonb columns.
      work_experiences: workExperiences.map((w) => ({
        id: randomUUID(),
        title: w.title,
        company: w.company,
        startYear: w.startYear,
        endYear: w.endYear ?? null,
        isCurrent: w.isCurrent,
        description: null,
      })),
      educations: educations.map((e) => ({
        id: randomUUID(),
        degree: e.degree,
        institution: e.institution,
        field: e.fieldOfStudy ?? null,
        endYear: e.endYear ?? null,
      })),
      // Same bucket, same path as the source application — application-assets is public now, so
      // no file copy and no signing is needed, just carry the path forward as-is.
      photo_path: application.photo_path,
      application_id: application.id,
      is_verified: true,
      status: 'active',
    });

    const approvedPreference = submittedPreferences.find((p) => p.serviceId === dto.approvedServiceId)!;
    await this.applicationsRepository.insertMemberServices([
      {
        member_id: application.applicant_id,
        service_id: approvedPreference.serviceId,
        custom_label: approvedPreference.customLabel ?? null,
      },
    ]);

    await this.applicationsRepository.promoteToMember(application.applicant_id);
    await this.applicationsRepository.markApproved(applicationId, reviewer.id, reviewedAt);

    return { status: 'approved' };
  }

  private async resolveServiceDetails(servicePreferences: { serviceId: string }[]): Promise<Map<string, ServiceDetail>> {
    if (servicePreferences.length === 0) return new Map();
    return this.applicationsRepository.findServiceDetails(servicePreferences.map((p) => p.serviceId));
  }

  private async assertActiveAndResolveServices(
    servicePreferences: { serviceId: string; customLabel?: string }[]
  ): Promise<Map<string, ServiceDetail>> {
    if (servicePreferences.length === 0) return new Map();

    const ids = servicePreferences.map((p) => p.serviceId);
    const duplicateIds = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (duplicateIds.length > 0) {
      // Most commonly hit via "Other" picked in more than one priority slot — two rows sharing a
      // service_id would collide on member_services' (member_id, service_id) primary key later.
      throw new BadRequestException(`Duplicate service id(s) across preferences: ${[...new Set(duplicateIds)].join(', ')}`);
    }

    const details = await this.applicationsRepository.findServiceDetails(ids);

    const invalidIds = ids.filter((id) => !details.get(id)?.isActive);
    if (invalidIds.length > 0) {
      throw new BadRequestException(`Invalid or inactive service id(s): ${invalidIds.join(', ')}`);
    }
    const missingCustomLabels = servicePreferences
      .filter((p) => details.get(p.serviceId)?.isCustom && !p.customLabel?.trim())
      .map((p) => p.serviceId);
    if (missingCustomLabels.length > 0) {
      throw new BadRequestException(`customLabel required for custom service id(s): ${missingCustomLabels.join(', ')}`);
    }
    return details;
  }

  private assertComplete(row: Row) {
    const missing = REQUIRED_TO_SUBMIT.filter(([column]) => row[column] === null || row[column] === undefined).map(
      ([, key]) => key
    );

    // region has no defensible derivation for country === 'Other' (see deriveRegion) — don't
    // block submission on it in that one case.
    if (row.region == null && row.country !== 'Other') missing.push('region');

    const workExperiences = (row.work_experiences ?? []) as {
      company?: string;
      companyUrl?: string;
      isCurrent?: boolean;
    }[];
    const educations = (row.educations ?? []) as unknown[];
    const peerReferences = (row.peer_references ?? []) as unknown[];
    const servicePreferences = (row.service_preferences ?? []) as unknown[];
    if (workExperiences.length < 1) missing.push('workExperiences');
    else {
      const currentJob = workExperiences.find((w) => w.isCurrent);
      // Whichever entry is marked isCurrent becomes the approved member's firm_name/firm_website
      // — require both so neither is ever silently null (see
      // ApplicationsService.reviewApplication()'s approve path). firm_website has no exemption
      // for an independent practitioner: any well-formed URL is accepted (a personal site, or a
      // LinkedIn company/profile page), not just a firm domain — so there's always something to
      // submit here, and the check applies uniformly.
      if (!currentJob?.company?.trim()) {
        missing.push('workExperiences must include a current position (isCurrent) with a company name');
      } else if (!currentJob.companyUrl?.trim()) {
        missing.push('workExperiences current position must include a company website (companyUrl)');
      }
    }
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

  private resolveDocuments(documents: Row[]): ApplicationDocumentDto[] {
    return documents.map((doc) => ({
      id: doc.id,
      filename: doc.filename,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      url: this.applicationsRepository.getPublicUrl(doc.path),
      uploadedAt: doc.uploadedAt,
    }));
  }

  private toServicePreferences(
    preferences: { serviceId: string; priority: 1 | 2 | 3; customLabel?: string }[],
    serviceDetails: Map<string, ServiceDetail>
  ): ServicePreference[] {
    return preferences.map((p) => {
      const detail = serviceDetails.get(p.serviceId);
      return {
        serviceId: p.serviceId,
        priority: p.priority,
        customLabel: p.customLabel,
        serviceName: detail?.name ?? 'Unknown',
        categoryId: detail?.categoryId ?? '',
        categoryName: detail?.categoryName ?? 'Unknown',
      };
    });
  }

  private async toDto(row: ApplicationRow, serviceDetails: Map<string, ServiceDetail>): Promise<ApplicationDto> {
    const servicePreferences = this.toServicePreferences(row.service_preferences ?? [], serviceDetails);

    return {
      id: row.id,
      status: row.status,
      currentStep: row.current_step,
      // The photo's storage key is stable across re-uploads (fixed 2026-09-26 — see uploadFile()),
      // which means its URL is too; Supabase Storage serves it with `Cache-Control: max-age=3600`,
      // so without a cache-busting param the browser would keep showing a stale cached image at
      // that same URL after a re-upload. row.updated_at changes on every write to this row
      // (including a photo upload, via saveUploadReference), so it's a free, already-there value
      // to bust the cache with — not a new column.
      photoUrl: row.photo_path
        ? `${this.applicationsRepository.getPublicUrl(row.photo_path)}?v=${encodeURIComponent(row.updated_at)}`
        : null,
      documents: this.resolveDocuments(row.documents ?? []),
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
      linkedinImportConsent: row.linkedin_import_consent,
      backgroundCheckConsent: row.background_check_consent,
      termsVersionAgreed: row.terms_version_agreed,
      privacyVersionAgreed: row.privacy_version_agreed,
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
      rejectionReason: row.rejection_reason,
    };
  }
}
