import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import {
  getAdminPerksServer,
  getAdminLearningsServer,
  getAdminResourceCollectionsServer,
  getAdminTemplatesServer,
} from '@/lib/api/resources.server';
import { ApiError } from '@/lib/api/client';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { Button, Card } from '@/components/ui';
import { AdminResources } from '@/components/resources/AdminResources';
export const metadata = { title: 'Resources — Admin — GrowXQ' };
export default async function AdminResourcesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login?returnTo=/admin/resources');
  if (user.role !== 'admin') redirect('/');
  let resources;
  try {
    resources = await Promise.all([
      getAdminPerksServer(),
      getAdminLearningsServer(),
      getAdminResourceCollectionsServer(),
      getAdminTemplatesServer(),
    ]);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'PERMISSION_REQUIRED')
      return (
        <PageContainer className="py-16">
          <Card>
            <h1 className="mb-3 text-heading">Resources access required</h1>
            <p className="mb-5 text-sm text-ink-3">Your admin account does not have permission to manage resources.</p>
            <Button href="/admin">Back to admin</Button>
          </Card>
        </PageContainer>
      );
    throw error;
  }
  return (
    <>
      <PageHero
        eyebrow="Admin / Resources"
        title="A better-equipped community."
        lede="Manage perks, useful videos, member templates, and the collections that bring them together."
      >
        <div className="flex flex-wrap gap-3">
          <Button href="/perks" variant="ghost-dark">
            View perks ↗
          </Button>
          <Button href="/learnings" variant="ghost-dark">
            View learnings ↗
          </Button>
          <Button href="/templates" variant="ghost-dark">
            View templates ↗
          </Button>
        </div>
      </PageHero>
      <PageContainer className="py-8">
        <AdminResources
          initialPerks={resources[0]}
          initialVideos={resources[1]}
          initialCollections={resources[2]}
          initialTemplates={resources[3]}
        />
      </PageContainer>
    </>
  );
}
