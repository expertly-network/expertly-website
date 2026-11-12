import { getResourceCollectionsServer, getTemplatesServer } from '@/lib/api/resources.server';
import { TemplatesLibrary } from '@/components/resources/TemplatesLibrary';
import { getSessionUser } from '@/lib/auth/session-claims';
export const metadata = {
  title: 'Templates — GrowXQ',
  description:
    'Professional templates for finance, tax & law practice: engagement letters, NDAs, audit checklists and more, ready to adapt.',
  alternates: { canonical: '/templates' },
};
export default async function TemplatesPage() {
  const [templates, collections, user] = await Promise.all([
    getTemplatesServer(),
    getResourceCollectionsServer(),
    getSessionUser(),
  ]);
  return (
    <TemplatesLibrary
      templates={templates}
      kits={collections.filter((c) => c.kind === 'template_kit')}
      signedIn={!!user}
    />
  );
}
