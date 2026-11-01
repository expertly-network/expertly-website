import { notFound, redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session-claims';
import { getAdminAiGenerationServer } from '@/lib/api/server';
import { PageContainer } from '@/components/layout/PageContainer';
import { PageHero, HeroBackLink } from '@/components/layout/PageHero';
import { AiGenerationDetail } from '@/components/admin/AiGenerationDetail';

export const metadata = {
  title: 'AI generation — Admin — GrowXQ',
};

// UX-only gate; the backend re-checks role + the manageArticles permission fresh on every request.
export default async function AdminAiGenerationDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const profile = await getSessionUser();
  if (!profile) {
    redirect(`/login?returnTo=/admin/ai-generations/${params.id}`);
  }
  if (profile.role !== 'admin') {
    redirect('/');
  }

  const generation = await getAdminAiGenerationServer(params.id);
  if (!generation) {
    notFound();
  }

  return (
    <div>
      <PageHero
        back={<HeroBackLink href="/admin/ai-generations">All AI generations</HeroBackLink>}
        eyebrow="Admin · AI generation"
        title={generation.draftTitle ?? 'Failed generation'}
        lede={<>Everything {generation.authorName} gave GrowXQ AI, and what it wrote back.</>}
      />
      <section className="py-12">
        <PageContainer>
          <AiGenerationDetail generation={generation} />
        </PageContainer>
      </section>
    </div>
  );
}
