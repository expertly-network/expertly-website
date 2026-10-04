import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminAiGenerationsServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { AdminAiGenerationsTable } from '@/components/admin/AdminAiGenerationsTable';

export const metadata = {
  title: 'AI generations — Admin — Expertly',
};

// UX-only gate; the backend re-checks role + the manageArticles permission fresh on every
// request (see AdminAiGenerationsController).
export default async function AdminAiGenerationsPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin/ai-generations');
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const generations = await getAdminAiGenerationsServer();

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">AI generations</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Every article draft generated with Expertly AI. Open one to see exactly what the member
            gave the AI, and what it wrote back. Showing the 200 most recent.
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <AdminAiGenerationsTable generations={generations} />
        </PageContainer>
      </section>
    </div>
  );
}
