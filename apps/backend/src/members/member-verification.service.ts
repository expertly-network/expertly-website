import { Injectable, NotFoundException } from '@nestjs/common';
import type { MemberEditSection } from '@shared/member';
import type { AdminMemberVerificationSummaryDto, VerifiableSection } from '@shared/member-verification';
import { VERIFIABLE_SECTIONS } from './dto/verification.dto';
import { ARRAY_SECTIONS, SECTION_TO_COLUMN, badRequest, type SectionItem } from './member-sections';
import { MembersRepository, type MemberProfileDetailRow } from './members.repository';

const SECTION_LABELS: Record<VerifiableSection, string> = {
  contact: 'Contact Information',
  engagements: 'Key Engagements',
  education: 'Education',
  work_experiences: 'Work Experience',
  key_clients: 'Key Clients',
  testimonials: 'Client Testimonials',
  awards: 'Awards & Recognition',
};

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/** A short human label for an item in the admin's list. */
export function itemLabel(section: VerifiableSection, item: SectionItem): string {
  const join = (...parts: unknown[]) => parts.map(str).filter(Boolean).join(' · ');
  switch (section) {
    case 'engagements':
    case 'awards':
      return str(item.title) || 'Untitled';
    case 'education':
      return join(item.degree, item.institution) || 'Education';
    case 'work_experiences':
      return join(item.title, item.company) || 'Role';
    case 'key_clients':
      return str(item.name) || 'Client';
    case 'testimonials':
      return join(item.clientName, item.clientCompany) || 'Testimonial';
    default:
      return SECTION_LABELS[section];
  }
}

function rawItems(row: MemberProfileDetailRow, section: VerifiableSection): SectionItem[] {
  if (section === 'contact') return [];
  const items = row[SECTION_TO_COLUMN[section as keyof typeof SECTION_TO_COLUMN] as keyof MemberProfileDetailRow];
  return Array.isArray(items) ? (items as unknown as SectionItem[]) : [];
}

@Injectable()
export class MemberVerificationService {
  constructor(private readonly membersRepository: MembersRepository) {}

  // ── admin ─────────────────────────────────────────────────────────────────────────────────
  // One row per active member with something to decide, plus members whose entries are all verified
  // but who have not been given the whole-profile badge yet.
  async adminSummary(): Promise<AdminMemberVerificationSummaryDto[]> {
    const rows = await this.membersRepository.findAllForVerification();
    const profiles = await this.membersRepository.findProfilesByIds(rows.map((r) => r.profile_id));

    const out: AdminMemberVerificationSummaryDto[] = [];
    for (const row of rows) {
      const unverifiedItems: AdminMemberVerificationSummaryDto['unverifiedItems'] = [];
      for (const section of VERIFIABLE_SECTIONS) {
        if (section === 'contact') continue;
        for (const item of rawItems(row, section)) {
          if (item.isVerified !== true && typeof item.id === 'string') {
            unverifiedItems.push({ section, itemId: item.id, label: itemLabel(section, item) });
          }
        }
      }
      const hasContact = [row.work_email, row.contact_phone, row.linkedin_url, row.website].some(Boolean);
      const contactPending = hasContact && !row.contact_verified;
      const needsReview = unverifiedItems.length + (contactPending ? 1 : 0);
      // Everything checked but the whole-profile badge not yet given: the admin's last step.
      const readyForBadge = needsReview === 0 && !row.is_verified;
      if (needsReview === 0 && !readyForBadge) continue;
      const profile = profiles.get(row.profile_id);
      out.push({
        memberId: row.profile_id,
        name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'Unknown member',
        slug: row.slug,
        contactVerified: row.contact_verified,
        unverifiedItems,
        needsReview,
        profileVerified: row.is_verified,
        readyForBadge,
      });
    }
    return out.sort((a, b) => b.needsReview - a.needsReview || a.name.localeCompare(b.name));
  }

  async adminSetItemVerified(
    memberId: string,
    section: MemberEditSection,
    itemId: string,
    verified: boolean
  ): Promise<void> {
    if (!ARRAY_SECTIONS.includes(section)) {
      throw badRequest('MEMBER_EDIT_SECTION_INVALID', `${section} has no verifiable items.`);
    }
    const row = await this.requireMember(memberId);
    const items = rawItems(row, section as VerifiableSection);
    if (!items.some((item) => item.id === itemId)) {
      throw new NotFoundException({ code: 'MEMBER_ITEM_NOT_FOUND', message: 'That item no longer exists.' });
    }
    const next = items.map((item) => {
      if (item.id !== itemId) return item;
      // Un-verifying forgets when it was last verified; verifying stamps it.
      const { verifiedAt: _previous, ...rest } = item;
      return verified
        ? { ...rest, isVerified: true, verifiedAt: new Date().toISOString() }
        : { ...rest, isVerified: false };
    });
    await this.membersRepository.applySectionEdit(
      memberId,
      SECTION_TO_COLUMN[section as keyof typeof SECTION_TO_COLUMN],
      section,
      next
    );
  }

  async adminSetContactVerified(memberId: string, verified: boolean): Promise<void> {
    await this.membersRepository.setContactVerified(memberId, verified);
  }

  async adminSetProfileVerified(memberId: string, verified: boolean): Promise<void> {
    await this.membersRepository.setProfileVerified(memberId, verified);
  }

  private async requireMember(memberId: string): Promise<MemberProfileDetailRow> {
    const row = await this.membersRepository.findDetailByProfileId(memberId);
    if (!row) throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member profile not found.' });
    return row;
  }
}
