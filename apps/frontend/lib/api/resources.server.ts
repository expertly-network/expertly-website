import { createClient } from '@/lib/supabase/server';
import { getApiBaseUrlServer } from '@/lib/api/base-url.server';
import { ApiError } from '@/lib/api/client';
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

async function read<T>(path: string): Promise<T> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  const response = await fetch(`${getApiBaseUrlServer()}/v1${path}`, {
    cache: 'no-store',
    headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.message || 'Resources could not be loaded.',
      response.status,
    );
  }
  return response.json();
}
export const getPerksServer = () => read<PerkDto[]>('/perks');
export const getLearningsServer = () => read<LearningDto[]>('/learnings');
export const getResourceCollectionsServer = () =>
  read<CollectionDto[]>('/collections');
export const getTemplatesServer = () => read<TemplateDto[]>('/templates');
export const getAdminTemplatesServer = () =>
  read<AdminTemplateDto[]>('/admin/templates');
export const getAdminPerksServer = () => read<AdminPerkDto[]>('/admin/perks');
export const getAdminLearningsServer = () =>
  read<AdminLearningDto[]>('/admin/learnings');
export const getAdminResourceCollectionsServer = () =>
  read<AdminCollectionDto[]>('/admin/collections');
