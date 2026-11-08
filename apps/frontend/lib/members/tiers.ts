import { MEMBER_TIER_LABEL } from './format';

// Ranges follow the approval contract: exactly 12 years is still Budding.
export const MEMBERSHIP_TIERS = [
  {
    key: 'budding_entrepreneur',
    name: 'Budding',
    label: MEMBER_TIER_LABEL.budding_entrepreneur,
    range: 'Usually 5 to 12 years in practice',
    summary: '5–12 years in practice',
    description:
      'You have built a solid practice and a growing list of clients who trust you. Your verified profile puts that record in front of new clients, and your work speaks for itself.',
    badgeClass: 'border-line bg-bg-alt text-ink-2',
  },
  {
    key: 'seasoned_professional',
    name: 'Seasoned',
    label: MEMBER_TIER_LABEL.seasoned_professional,
    range: 'Usually more than 12 years in practice',
    summary: '12+ years in practice',
    description:
      'You have led engagements, built a reputation and seen most situations before. Clients can rely on that depth for their most complex work.',
    badgeClass: 'border-warn-line bg-warn-soft text-warn',
  },
] as const;
