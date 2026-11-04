import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { MEMBERSHIP_TIERS } from '@/lib/members/tiers';

export function MembershipTierSection() {
  return (
    <section
      className="border-b border-line bg-bg-alt py-20 max-[640px]:py-14"
      aria-labelledby="membership-tiers-title"
    >
      <PageContainer>
        <Eyebrow>Membership tiers</Eyebrow>
        <h2 id="membership-tiers-title" className="font-brand mt-4 text-section-title text-ink">
          Budding or Seasoned. <span className="text-accent">Shown beside your name.</span>
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {MEMBERSHIP_TIERS.map((tier) => (
            <article key={tier.key} className="rounded-card border border-line bg-bg-card p-8 sm:p-10">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-caption font-semibold ${tier.badgeClass}`}
              >
                {tier.label}
              </span>
              <h3 className="font-brand mt-6 text-heading text-ink">{tier.name}</h3>
              <p className="mt-2 text-sm font-medium text-accent-2">{tier.range}</p>
              <p className="mt-4 text-lede text-ink-3">{tier.description}</p>
            </article>
          ))}
        </div>
        <p className="mt-5 text-caption text-ink-3">
          Years are a guide. Our team confirms your tier on your track record. Applications require at least five years
          of experience.
        </p>
      </PageContainer>
    </section>
  );
}
