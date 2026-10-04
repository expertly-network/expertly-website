import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminAiGenerationServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';
import { AiGenerationDetail } from '@/components/admin/AiGenerationDetail';

export const metadata = {
  title: 'AI generation — Admin — Expertly',
};

// UX-only gate; the backend re-checks role + the manageArticles permission fresh on every request.
export default async function AdminAiGenerationDetailPage({ params }: { params: { id: string } }) {
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/ai-generations/${params.id}`);
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  const generation = await getAdminAiGenerationServer(params.id);
  if (!generation) {
    notFound();
  }

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Link href="/admin/ai-generations" className="text-caption text-white/65 transition-colors hover:text-bg-card">
            ← All AI generations
          </Link>
          <div className="mt-4">
            <Eyebrow dark>Admin · AI generation</Eyebrow>
          </div>
          <h1 className="mt-2 break-words text-headline text-bg-card">
            {generation.draftTitle ?? 'Failed generation'}
          </h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Everything {generation.authorName} gave Expertly AI, and what it wrote back.
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <AiGenerationDetail generation={generation} />
        </PageContainer>
      </section>
    </div>
  );
}
