import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminAiGenerationsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero } from '@/components/layout/PageHero';
import { AdminAiGenerationsTable } from '@/components/admin/AdminAiGenerationsTable';

export const metadata = {
  title: 'AI generations — Admin — GrowXQ',
};

// UX-only gate; the backend re-checks role + the manageArticles permission fresh on every
// request (see AdminAiGenerationsController).
export default async function AdminAiGenerationsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/ai-generations');
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const generations = await getAdminAiGenerationsServer();

  return (
    <div>
      <PageHero
        eyebrow="Admin"
        title="AI generations"
        lede="Every article draft generated with GrowXQ AI. Open one to see exactly what the member gave the AI, and what it wrote back. Showing the 200 most recent."
      />
      <section className="py-12">
        <PageContainer>
          <AdminAiGenerationsTable generations={generations} />
        </PageContainer>
      </section>
    </div>
  );
}
