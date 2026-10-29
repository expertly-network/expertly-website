import {
  getLearningsServer,
  getResourceCollectionsServer,
} from '@/lib/api/resources.server';
import { LearningsLibrary } from '@/components/resources/LearningsLibrary';
export const metadata = { title: 'Learnings — GrowXQ' };
export default async function LearningsPage() {
  const [videos, collections] = await Promise.all([
    getLearningsServer(),
    getResourceCollectionsServer(),
  ]);
  return (
    <LearningsLibrary
      videos={videos}
      playlists={collections.filter((c) => c.kind === 'learning_playlist')}
    />
  );
}
