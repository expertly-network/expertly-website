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
import type { ApplicationDto, ServicePreference } from '@shared/membership-application';
import { CreateApplicationDto } from './dto/create-application.dto';
import { computeTier, MEMBERSHIP_PRICE_CENTS } from './constants/pricing';
import { applyCoupon } from './constants/coupons';

@Injectable()
export class ApplicationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(user: AuthenticatedUser, dto: CreateApplicationDto): Promise<ApplicationDto> {
    // Exact-role check, not @Roles('client') — RolesGuard's ranked model
    // (admin satisfies a 'member' check) is wrong here: this endpoint is for
    // client accounts specifically, not "client or higher."
    if (user.role !== 'client') {
      throw new ForbiddenException('Only client accounts can submit a membership application.');
    }

    if (dto.rateMaxCents <= dto.rateMinCents) {
      throw new BadRequestException('rateMaxCents must be greater than rateMinCents.');
    }

    const { data: existing, error: existingError } = await this.supabase.db
      .from('membership_applications')
      .select('id')
      .eq('applicant_id', user.id)
      .in('status', ['submitted', 'under_review'])
      .limit(1);

    if (existingError) throw new InternalServerErrorException('Failed to check existing applications.');
    if (existing && existing.length > 0) {
      throw new ConflictException('You already have an application in progress.');
    }

    // Load valid practice areas up front — used both to reject invalid
    // servicePreferences (the DB has no FK to catch this — see the migration
    // and docs/database-erd.md's "load-bearing trade-off" note) and to
    // resolve names for the response.
    const practiceAreaIds = dto.servicePreferences.map((p) => p.practiceAreaId);
    const { data: practiceAreas, error: practiceAreasError } = await this.supabase.db
      .from('practice_areas')
      .select('id, name')
      .eq('is_active', true)
      .in('id', practiceAreaIds);

    if (practiceAreasError) {
      throw new InternalServerErrorException('Failed to validate service preferences.');
    }

    const practiceAreaById = new Map((practiceAreas ?? []).map((p) => [p.id, p.name as string]));
    const invalidIds = practiceAreaIds.filter((id) => !practiceAreaById.has(id));
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Invalid or inactive practice area id(s): ${invalidIds.join(', ')}`
      );
    }

    const selectedTier = computeTier(dto.yearsOfExperience);
    const listPriceCents = MEMBERSHIP_PRICE_CENTS[dto.billingPeriod];

    const couponResult = applyCoupon(dto.couponCode, listPriceCents);
    if (!couponResult.valid) {
      throw new BadRequestException('Invalid or expired coupon code.');
    }

    const discountAmountCents = couponResult.discountAmountCents;
    const amountDueCents = Math.max(0, listPriceCents - discountAmountCents);
    const paymentStatus = amountDueCents === 0 ? 'waived' : 'pending';

    const { data: inserted, error: insertError } = await this.supabase.db
      .from('membership_applications')
      .insert({
        applicant_id: user.id,
        photo_url: dto.photoUrl ?? null,
        first_name: dto.firstName,
        last_name: dto.lastName,
        contact_email: dto.contactEmail,
        phone_country_code: dto.phoneCountryCode ?? null,
        phone: dto.phone ?? null,
        region: dto.region,
        country: dto.country,
        state: dto.state ?? null,
        city: dto.city ?? null,
        linkedin_url: dto.linkedinUrl,
        bio: dto.bio,
        years_of_experience: dto.yearsOfExperience,
        work_experiences: dto.workExperiences,
        educations: dto.educations,
        service_preferences: dto.servicePreferences,
        rate_min_cents: dto.rateMinCents,
        rate_max_cents: dto.rateMaxCents,
        selected_tier: selectedTier,
        billing_period: dto.billingPeriod,
        list_price_cents: listPriceCents,
        coupon_code: dto.couponCode ?? null,
        discount_amount_cents: discountAmountCents,
        amount_due_cents: amountDueCents,
        payment_status: paymentStatus,
        linkedin_import_consent: dto.linkedinImportConsent,
        terms_version_agreed: dto.termsVersionAgreed,
        privacy_version_agreed: dto.privacyVersionAgreed,
        background_check_consent: dto.backgroundCheckConsent,
      })
      .select()
      .single();

    if (insertError || !inserted) {
      throw new InternalServerErrorException('Failed to submit application.');
    }

    return this.toDto(inserted, practiceAreaById);
  }

  async findMine(userId: string): Promise<ApplicationDto> {
    const { data, error } = await this.supabase.db
      .from('membership_applications')
      .select()
      .eq('applicant_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new InternalServerErrorException('Failed to load application.');
    if (!data) throw new NotFoundException('No application found for this account.');

    const servicePrefs = (data.service_preferences ?? []) as { practiceAreaId: string }[];
    const ids = servicePrefs.map((p) => p.practiceAreaId);
    const practiceAreaById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: practiceAreas } = await this.supabase.db
        .from('practice_areas')
        .select('id, name')
        .in('id', ids);
      for (const p of practiceAreas ?? []) practiceAreaById.set(p.id, p.name);
    }

    return this.toDto(data, practiceAreaById);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDto(row: any, practiceAreaById: Map<string, string>): ApplicationDto {
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
      photoUrl: row.photo_url,
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
