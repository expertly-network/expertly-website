import { getLearningsServer, getResourceCollectionsServer } from '@/lib/api/resources.server';
import { LearningsLibrary } from '@/components/resources/LearningsLibrary';
export const metadata = {
  title: 'Learnings — GrowXQ',
  description:
    'Short videos on AI, drafting, Excel and data privacy for finance, tax & law professionals: the technology your profession never taught you.',
  alternates: { canonical: '/learnings' },
};
export default async function LearningsPage() {
  const [videos, collections] = await Promise.all([getLearningsServer(), getResourceCollectionsServer()]);
  return <LearningsLibrary videos={videos} playlists={collections.filter((c) => c.kind === 'learning_playlist')} />;
}
