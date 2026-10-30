import { getResourceCollectionsServer, getTemplatesServer } from '@/lib/api/resources.server';
import { TemplatesLibrary } from '@/components/resources/TemplatesLibrary';
import { getSessionUser } from '@/lib/auth/session-claims';
export const metadata = { title: 'Templates — GrowXQ' };
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
