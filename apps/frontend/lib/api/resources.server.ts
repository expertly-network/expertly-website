import { authedGet, viewerDependentList } from '@/lib/api/server';
import type {
  PerkDto,
  LearningDto,
  CollectionDto,
  AdminPerkDto,
  AdminLearningDto,
  AdminCollectionDto,
  TemplateDto,
  AdminTemplateDto,
} from '@shared/resource';

const ERROR_MESSAGE = 'Resources could not be loaded.';

// Public library lists: what's unlocked (codes, URLs, files) depends on the viewer's role, so a
// signed-in viewer's request is never cached; anonymous visitors share a cached response.
export const getPerksServer = () => viewerDependentList<PerkDto>('/perks', ERROR_MESSAGE);
export const getLearningsServer = () => viewerDependentList<LearningDto>('/learnings', ERROR_MESSAGE);
export const getResourceCollectionsServer = () => viewerDependentList<CollectionDto>('/collections', ERROR_MESSAGE);
export const getTemplatesServer = () => viewerDependentList<TemplateDto>('/templates', ERROR_MESSAGE);

// Admin lists — per-viewer, never cached; empty when signed out (the admin layout redirects first).
function adminList<T>(path: string): Promise<T[]> {
  return authedGet<T[], T[]>(path, { signedOut: [], errorMessage: ERROR_MESSAGE });
}
export const getAdminTemplatesServer = () => adminList<AdminTemplateDto>('/admin/templates');
export const getAdminPerksServer = () => adminList<AdminPerkDto>('/admin/perks');
export const getAdminLearningsServer = () => adminList<AdminLearningDto>('/admin/learnings');
export const getAdminResourceCollectionsServer = () => adminList<AdminCollectionDto>('/admin/collections');
