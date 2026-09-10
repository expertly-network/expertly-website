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

// Pinned to file-type@16 deliberately — v17+ is pure ESM with an exports-map-only type layout
// that this backend's CommonJS moduleResolution can't resolve (confirmed: TS2307 even via a
// dynamic import()). v16 is the last CJS-native major, so a plain static import works.
type UploadKind = 'photo' | 'document';

const ALLOWED_MIME: Record<UploadKind, string[]> = {
  photo: ['image/jpeg', 'image/png'],
  document: ['image/jpeg', 'image/png', 'application/pdf'],
};
const MAX_BYTES: Record<UploadKind, number> = {
  photo: 5 * 1024 * 1024,
  document: 15 * 1024 * 1024,
};

// A draft row is the one deliberate exception to this table's otherwise-immutable-snapshot
// design (see supabase/migrations/0004_tables.sql's table comment) — these are the columns a
// save-on-advance write is allowed to touch. Kept as a literal map (not derived from
// UpdateApplicationDto's keys) so a future DTO field addition doesn't silently become writable
// here without a deliberate edit to this map too.
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
    private readonly repository: ApplicationsRepository,
    private readonly linkedInImportProvider: LinkedInImportProvider
  ) {}

  async saveOrSubmit(user: AuthenticatedUser, dto: UpdateApplicationDto): Promise<ApplicationDto> {
    // Exact-role check, not @Roles('client') — RolesGuard's ranked model (admin
    // satisfies a 'member' check) is wrong here: this endpoint is for client
    // accounts specifically, not "client or higher."
    if (user.role !== 'client') {
      throw new ForbiddenException('Only client accounts can manage a membership application.');
    }

    const latest = await this.repository.findLatestByApplicant(user.id);

    // 'rejected' deliberately does NOT block a new application — matches the frontend's
    // pre-existing intent (app/apply/page.tsx's redirect gate only blocks
    // submitted/under_review/approved) and lets a rejected applicant try again. 'approved' is
    // blocked here for defense-in-depth even though the role check above already makes it
    // unreachable in practice (an approved applicant's role is flipped to 'member', so they'd
    // never pass as user.role === 'client' to begin with).
    if (latest && ['submitted', 'under_review', 'approved'].includes(latest.status)) {
      throw new ConflictException('You already have an application in progress or decided.');
    }

    // A 'rejected' row is a historical record, not something this call should mutate — a fresh
    // application after rejection starts a brand-new row (insert path below), leaving the
    // rejection intact for audit rather than silently overwriting it back to 'draft'.
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

    // MUST validate every practiceAreaId against a live, active practice_areas lookup before
    // any insert/update that carries service_preferences — there's no FK/CASCADE safety net on
    // this jsonb column (see supabase/migrations/0004_tables.sql's comment on it). Only runs
    // when this call actually touches service_preferences, not on every unrelated save.
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
      ? await this.repository.updateById(existing.id, patch)
      : await this.repository.insert({ ...patch, applicant_id: user.id });

    // If this call didn't touch service_preferences, resolve names from whatever the saved row
    // already carries (read path — no is_active filter, same "an already-saved reference keeps
    // showing its real name even if since deactivated" convention articles.practice_area_ids
    // uses on read).
    if (dto.servicePreferences === undefined) {
      practiceAreaById = await this.resolvePracticeAreaNames(saved.service_preferences ?? []);
    }

    return this.toDto(saved, practiceAreaById);
  }

  async findMine(userId: string): Promise<ApplicationDto> {
    const data = await this.repository.findLatestByApplicant(userId);
    if (!data) throw new NotFoundException('No application found for this account.');

    const practiceAreaById = await this.resolvePracticeAreaNames(data.service_preferences ?? []);
    return this.toDto(data, practiceAreaById);
  }

  async importFromLinkedIn(linkedinUrl: string) {
    return this.linkedInImportProvider.importProfile(linkedinUrl);
  }

  // Proxies the upload through the backend rather than issuing a signed upload URL (unlike
  // members.service.ts's requestUpload) — a signed-URL flow never puts the file's bytes through
  // the API, so magic-byte MIME validation (root CLAUDE.md's non-negotiable file-upload rule)
  // would be structurally impossible. See the spec doc §6 for the full rationale.
  //
  // `file`'s shape is deliberately a plain object, not Express.Multer.File/Fastify's
  // MultipartFile — the controller adapts whatever the HTTP adapter hands it into this shape,
  // so this service stays adapter-agnostic (see applications.controller.ts's uploadFile).
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

    const existing = await this.repository.findLatestForUpload(user.id);
    if (!existing || existing.status !== 'draft') {
      throw new BadRequestException('No draft application to attach this file to.');
    }

    const existingDocuments = (existing.documents ?? []) as Row[];
    const path =
      kind === 'photo'
        ? `members/application/${user.id}/profile-photo.${sniffed.ext}`
        : `members/application/${user.id}/document-${existingDocuments.length + 1}.${sniffed.ext}`;

    await this.repository.uploadFile(path, file.buffer, sniffed.mime);

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

    const saved = await this.repository.saveUploadReference(existing.id, patch);

    const practiceAreaById = await this.resolvePracticeAreaNames(saved.service_preferences ?? []);
    return this.toDto(saved, practiceAreaById);
  }

  // 🛡️ manageApplications — the admin review queue's list view. Defaults to the two
  // reviewable statuses (draft/approved/rejected already have a decided or not-yet-actionable
  // outcome); pass `status` to look at a specific bucket instead, e.g. 'approved' to audit past
  // decisions.
  async listForReview(status?: ApplicationStatus): Promise<AdminApplicationListItemDto[]> {
    return this.repository.listForReview(status);
  }

  // Approve/reject a submitted application. Not a real DB transaction — supabase-js has no
  // multi-statement transaction API from a service-role client, so this is a deliberately
  // ordered sequence instead: member_profiles/member_services are provisioned and the role flip
  // happens *before* the application itself is marked 'approved', so a mid-sequence failure
  // leaves the application still 'submitted' (reviewable again) rather than silently 'approved'
  // with no member actually provisioned.
  async reviewApplication(
    applicationId: string,
    reviewer: AuthenticatedUser,
    dto: ReviewApplicationDto
  ): Promise<{ status: 'approved' | 'rejected' }> {
    const application = await this.repository.findByIdForReview(applicationId);
    if (!['submitted', 'under_review'].includes(application.status)) {
      throw new ConflictException('Only a submitted or under-review application can be reviewed.');
    }
    if (dto.status === 'rejected' && !dto.rejectionReason) {
      throw new BadRequestException('rejectionReason is required when rejecting.');
    }

    const reviewedAt = new Date().toISOString();

    if (dto.status === 'rejected') {
      await this.repository.applyRejection(applicationId, {
        status: 'rejected',
        reviewed_by: reviewer.id,
        reviewed_at: reviewedAt,
        rejection_reason: dto.rejectionReason,
      });
      return { status: 'rejected' };
    }

    const photoUrl = application.photo_path ? await this.repository.createSignedUrl(application.photo_path) : null;

    await this.repository.insertMemberProfile({
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
      await this.repository.insertMemberServices(
        servicePreferences.map((p) => ({
          member_id: application.applicant_id,
          practice_area_id: p.practiceAreaId,
        }))
      );
    }

    await this.repository.promoteToMember(application.applicant_id);
    await this.repository.markApproved(applicationId, reviewer.id, reviewedAt);

    return { status: 'approved' };
  }

  /** Read path — resolves names with no is_active filter (see findMine's comment). */
  private async resolvePracticeAreaNames(servicePreferences: { practiceAreaId: string }[]): Promise<Map<string, string>> {
    if (servicePreferences.length === 0) return new Map();
    return this.repository.findPracticeAreaNames(servicePreferences.map((p) => p.practiceAreaId));
  }

  /** Write path — rejects any id that isn't a real, currently-active practice area. */
  private async assertActiveAndResolve(servicePreferences: { practiceAreaId: string }[]): Promise<Map<string, string>> {
    if (servicePreferences.length === 0) return new Map();

    const ids = servicePreferences.map((p) => p.practiceAreaId);
    const practiceAreaById = await this.repository.findActivePracticeAreaNames(ids);

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
    // Exactly 2, not "at least 2" — matches the client's explicit "two peer references" ask,
    // not an open-ended list.
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
        url: (await this.repository.createSignedUrl(doc.path)) ?? '',
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
      photoUrl: row.photo_path ? await this.repository.createSignedUrl(row.photo_path) : null,
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
