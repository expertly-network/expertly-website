import { getPerksServer, getResourceCollectionsServer } from '@/lib/api/resources.server';
import { PerksLibrary } from '@/components/resources/PerksLibrary';
import { getSessionUser } from '@/lib/auth/session-claims';
export const metadata = {
  title: 'Perks — GrowXQ',
  description:
    'Exclusive discounts on the software and services finance, tax & law professionals use, negotiated for GrowXQ members.',
  alternates: { canonical: '/perks' },
};
export default async function PerksPage() {
  const [perks, collections, user] = await Promise.all([
    getPerksServer(),
    getResourceCollectionsServer(),
    getSessionUser(),
  ]);
  return <PerksLibrary perks={perks} stacks={collections.filter((c) => c.kind === 'perk_stack')} signedIn={!!user} />;
}
