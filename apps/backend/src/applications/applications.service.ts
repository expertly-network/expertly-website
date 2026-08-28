import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../auth/supabase.service';
import type { AuthenticatedUser } from '../auth/types/auth.types';
import type {
  ApplicationDocumentDto,
  ApplicationDto,
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

type UploadKind = 'photo' | 'document';

const ALLOWED_MIME: Record<UploadKind, string[]> = {
  photo: ['image/jpeg', 'image/png'],
  document: ['image/jpeg', 'image/png', 'application/pdf'],
};
const MAX_BYTES: Record<UploadKind, number> = {
  photo: 5 * 1024 * 1024,
  document: 15 * 1024 * 1024,
};

const APPLICATION_COLUMNS =
  'id, status, current_step, photo_path, documents, first_name, last_name, contact_email, phone_country_code, phone, region, country, state, city, linkedin_url, bio, years_of_experience, work_experiences, educations, service_preferences, rate_min_cents, rate_max_cents, selected_tier, billing_period, list_price_cents, coupon_code, discount_amount_cents, amount_due_cents, payment_status, created_at';

const APPLICATION_MERGE_COLUMNS =
  'id, status, first_name, last_name, contact_email, region, country, linkedin_url, bio, years_of_experience, work_experiences, educations, service_preferences, rate_min_cents, rate_max_cents, billing_period, coupon_code, background_check_consent, terms_version_agreed, privacy_version_agreed';

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

type Row = Record<string, any>;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly linkedInImportProvider: LinkedInImportProvider
  ) { }

  async saveOrSubmit(user: AuthenticatedUser, dto: UpdateApplicationDto): Promise<ApplicationDto> {
    // Exact-role check, not @Roles('client') — its ranked model would wrongly admit admins too.
    if (user.role !== 'client') {
      throw new ForbiddenException('Only client accounts can manage a membership application.');
    }

    const { data: latest, error: latestError } = await this.supabase.db
      .from('membership_applications')
      .select(APPLICATION_MERGE_COLUMNS)
      .eq('applicant_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw new InternalServerErrorException('Failed to load application.');

    // 'rejected' doesn't block a retry; 'approved' is checked only for defense-in-depth.
    if (latest && ['submitted', 'under_review', 'approved'].includes(latest.status)) {
      throw new ConflictException('You already have an application in progress or decided.');
    }

    // A rejected row is kept as history, not reused — a retry after rejection inserts a new row.
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

    // service_preferences has no FK/CASCADE — ids must be validated live against practice_areas.
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

    const { data: saved, error: saveError } = existing
      ? await this.supabase.db
        .from('membership_applications')
        .update(patch)
        .eq('id', existing.id)
        .select(APPLICATION_COLUMNS)
        .single()
      : await this.supabase.db
        .from('membership_applications')
        .insert({ ...patch, applicant_id: user.id })
        .select(APPLICATION_COLUMNS)
        .single();
    if (saveError || !saved) throw new InternalServerErrorException('Failed to save application.');

    // Not touched this call — resolve names from the saved row instead (no is_active filter).
    if (dto.servicePreferences === undefined) {
      practiceAreaById = await this.resolvePracticeAreaNames(saved.service_preferences ?? []);
    }

    return this.toDto(saved, practiceAreaById);
  }

  async findMine(userId: string): Promise<ApplicationDto> {
    const { data, error } = await this.supabase.db
      .from('membership_applications')
      .select(APPLICATION_COLUMNS)
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load application.');
    if (!data) throw new NotFoundException('No application found for this account.');

    const practiceAreaById = await this.resolvePracticeAreaNames(data.service_preferences ?? []);
    return this.toDto(data, practiceAreaById);
  }

  async importFromLinkedIn(linkedinUrl: string) {
    return this.linkedInImportProvider.importProfile(linkedinUrl);
  }

  // Proxied through the backend, not a signed URL, so magic-byte MIME validation can inspect the bytes.
  async uploadFile(user: AuthenticatedUser, kind: UploadKind, file: Express.Multer.File): Promise<ApplicationDto> {
    if (file.size > MAX_BYTES[kind]) {
      throw new BadRequestException(`File too large — max ${MAX_BYTES[kind] / 1024 / 1024}MB for ${kind}.`);
    }

    const sniffed = await sniffFileType(file.buffer);
    if (!sniffed || !ALLOWED_MIME[kind].includes(sniffed.mime)) {
      throw new BadRequestException(`Unsupported file type for ${kind}.`);
    }

    const { data: existing, error: existingError } = await this.supabase.db
      .from('membership_applications')
      .select('id, status, documents')
      .eq('applicant_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError || !existing || existing.status !== 'draft') {
      throw new BadRequestException('No draft application to attach this file to.');
    }

    const existingDocuments = (existing.documents ?? []) as Row[];
    const path =
      kind === 'photo'
        ? `members/application/${user.id}/profile-photo.${sniffed.ext}`
        : `members/application/${user.id}/document-${existingDocuments.length + 1}.${sniffed.ext}`;

    const { error: uploadError } = await this.supabase.db.storage
      .from('application-assets')
      .upload(path, file.buffer, { contentType: sniffed.mime, upsert: true });
    if (uploadError) throw new InternalServerErrorException('Failed to store file.');

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

    const { data: saved, error: saveError } = await this.supabase.db
      .from('membership_applications')
      .update(patch)
      .eq('id', existing.id)
      .select(APPLICATION_COLUMNS)
      .single();
    if (saveError || !saved) throw new InternalServerErrorException('Failed to save upload reference.');

    const practiceAreaById = await this.resolvePracticeAreaNames(saved.service_preferences ?? []);
    return this.toDto(saved, practiceAreaById);
  }

  // Not a real transaction — provisioning runs before the status flips to 'approved', so a mid-failure leaves it reviewable, not falsely approved.
  async reviewApplication(
    applicationId: string,
    reviewer: AuthenticatedUser,
    dto: ReviewApplicationDto
  ): Promise<{ status: 'approved' | 'rejected' }> {
    const { data: application, error } = await this.supabase.db
      .from('membership_applications')
      .select(
        'id, applicant_id, status, photo_path, bio, region, country, state, city, years_of_experience, rate_min_cents, rate_max_cents, selected_tier, contact_email, linkedin_url, service_preferences'
      )
      .eq('id', applicationId)
      .maybeSingle();
    if (error) throw new InternalServerErrorException('Failed to load application.');
    if (!application) throw new NotFoundException('Application not found.');
    if (!['submitted', 'under_review'].includes(application.status)) {
      throw new ConflictException('Only a submitted or under-review application can be reviewed.');
    }
    if (dto.status === 'rejected' && !dto.rejectionReason) {
      throw new BadRequestException('rejectionReason is required when rejecting.');
    }

    const reviewedAt = new Date().toISOString();

    if (dto.status === 'rejected') {
      const { error: updateError } = await this.supabase.db
        .from('membership_applications')
        .update({
          status: 'rejected',
          reviewed_by: reviewer.id,
          reviewed_at: reviewedAt,
          rejection_reason: dto.rejectionReason,
        })
        .eq('id', applicationId);
      if (updateError) throw new InternalServerErrorException('Failed to reject application.');
      return { status: 'rejected' };
    }

    const photoUrl = application.photo_path ? await this.signedUrl(application.photo_path) : null;

    const { error: profileError } = await this.supabase.db.from('member_profiles').insert({
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
    if (profileError) throw new InternalServerErrorException('Failed to provision member profile.');

    const servicePreferences = (application.service_preferences ?? []) as { practiceAreaId: string }[];
    if (servicePreferences.length > 0) {
      const { error: servicesError } = await this.supabase.db.from('member_services').insert(
        servicePreferences.map((p) => ({
          member_id: application.applicant_id,
          practice_area_id: p.practiceAreaId,
        }))
      );
      if (servicesError) throw new InternalServerErrorException('Failed to provision member services.');
    }

    const { error: roleError } = await this.supabase.db
      .from('profiles')
      .update({ role: 'member' })
      .eq('id', application.applicant_id);
    if (roleError) throw new InternalServerErrorException('Failed to promote applicant to member.');

    const { error: appUpdateError } = await this.supabase.db
      .from('membership_applications')
      .update({ status: 'approved', reviewed_by: reviewer.id, reviewed_at: reviewedAt })
      .eq('id', applicationId);
    if (appUpdateError) throw new InternalServerErrorException('Failed to finalize application status.');

    return { status: 'approved' };
  }

  /** Read path — no is_active filter, so a deactivated practice area still resolves its name. */
  private async resolvePracticeAreaNames(
    servicePreferences: { practiceAreaId: string }[]
  ): Promise<Map<string, string>> {
    const practiceAreaById = new Map<string, string>();
    if (servicePreferences.length === 0) return practiceAreaById;

    const ids = servicePreferences.map((p) => p.practiceAreaId);
    const { data: practiceAreas, error } = await this.supabase.db
      .from('practice_areas')
      .select('id, name')
      .in('id', ids);
    if (error) throw new InternalServerErrorException('Failed to resolve service preferences.');

    for (const p of practiceAreas ?? []) practiceAreaById.set(p.id, p.name);
    return practiceAreaById;
  }

  /** Write path — rejects any id that isn't a real, active practice area. */
  private async assertActiveAndResolve(
    servicePreferences: { practiceAreaId: string }[]
  ): Promise<Map<string, string>> {
    const practiceAreaById = new Map<string, string>();
    if (servicePreferences.length === 0) return practiceAreaById;

    const ids = servicePreferences.map((p) => p.practiceAreaId);
    const { data: practiceAreas, error } = await this.supabase.db
      .from('practice_areas')
      .select('id, name')
      .eq('is_active', true)
      .in('id', ids);
    if (error) throw new InternalServerErrorException('Failed to validate service preferences.');

    for (const p of practiceAreas ?? []) practiceAreaById.set(p.id, p.name);
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
    const servicePreferences = (row.service_preferences ?? []) as unknown[];
    if (workExperiences.length < 1) missing.push('workExperiences');
    if (educations.length < 1) missing.push('educations');
    if (servicePreferences.length < 1) missing.push('servicePreferences');
    if (row.background_check_consent !== true) missing.push('backgroundCheckConsent must be true');
    if (!row.terms_version_agreed) missing.push('termsVersionAgreed');
    if (!row.privacy_version_agreed) missing.push('privacyVersionAgreed');

    if (missing.length > 0) {
      throw new BadRequestException(`Cannot submit — missing or invalid: ${missing.join(', ')}`);
    }
  }

  private async signedUrl(path: string): Promise<string | null> {
    const { data } = await this.supabase.db.storage
      .from('application-assets')
      .createSignedUrl(path, 60 * 60);
    return data?.signedUrl ?? null;
  }

  private async resolveDocuments(documents: Row[]): Promise<ApplicationDocumentDto[]> {
    return Promise.all(
      documents.map(async (doc) => ({
        id: doc.id,
        filename: doc.filename,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        url: (await this.signedUrl(doc.path)) ?? '',
        uploadedAt: doc.uploadedAt,
      }))
    );
  }

  private async toDto(row: Row, practiceAreaById: Map<string, string>): Promise<ApplicationDto> {
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
      photoUrl: row.photo_path ? await this.signedUrl(row.photo_path) : null,
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
