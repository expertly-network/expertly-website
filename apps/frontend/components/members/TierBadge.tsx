import type { MemberListItemDto } from '@shared/member';

type Tier = MemberListItemDto['memberTier'];

const LABEL: Record<Tier, string> = {
  budding_entrepreneur: 'Budding',
  seasoned_professional: 'Seasoned',
};

// Budding = brand green with a sprout, Seasoned = amber with a star. Shared by the member cards and
// the directory's tier explainer so the two always read the same.
const TONE: Record<Tier, string> = {
  budding_entrepreneur:
    'border-[color-mix(in_oklab,var(--accent)_35%,transparent)] bg-[color-mix(in_oklab,var(--accent)_8%,transparent)] text-accent',
  seasoned_professional: 'border-warn-line bg-warn-soft text-warn',
};

const SIZE = {
  sm: 'gap-1 px-2.5 py-[3px] text-[11px]',
  md: 'gap-1.5 px-3 py-1 text-caption',
} as const;

export function TierBadge({ tier, size = 'sm' }: { tier: Tier; size?: keyof typeof SIZE }) {
  return (
    <span
      className={`inline-flex flex-none items-center rounded-full border font-semibold ${TONE[tier]} ${SIZE[size]}`}
    >
      {tier === 'budding_entrepreneur' ? (
        <span aria-hidden="true">🌱</span>
      ) : (
        <svg width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z" />
        </svg>
      )}
      {LABEL[tier]}
    </span>
  );
}
