import { apiFetch } from './client';
import type {
  AdminPerkDto,
  AdminLearningDto,
  AdminCollectionDto,
  CreatePerkRequest,
  CreateLearningRequest,
  CreateCollectionRequest,
  UpdatePerkRequest,
  UpdateLearningRequest,
  UpdateCollectionRequest,
  AdminTemplateDto,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateDownloadDto,
  TemplateUploadDto,
} from '@shared/resource';
export const createPerk = (body: CreatePerkRequest) =>
  apiFetch<AdminPerkDto>('/admin/perks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const updatePerk = (id: string, body: UpdatePerkRequest) =>
  apiFetch<AdminPerkDto>(`/admin/perks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
export const createLearning = (body: CreateLearningRequest) =>
  apiFetch<AdminLearningDto>('/admin/learnings', {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const updateLearning = (id: string, body: UpdateLearningRequest) =>
  apiFetch<AdminLearningDto>(`/admin/learnings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
export const createCollection = (body: CreateCollectionRequest) =>
  apiFetch<AdminCollectionDto>('/admin/collections', {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const updateCollection = (id: string, body: UpdateCollectionRequest) =>
  apiFetch<AdminCollectionDto>(`/admin/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
// Members only: a 60-second signed link for one template file.
export const getTemplateDownload = (id: string) =>
  apiFetch<TemplateDownloadDto>(`/templates/${id}/download`, { method: 'POST' });
export const uploadTemplateFile = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<TemplateUploadDto>('/admin/templates/upload', {
    method: 'POST',
    body: form,
  });
};
export const createTemplate = (body: CreateTemplateRequest) =>
  apiFetch<AdminTemplateDto>('/admin/templates', {
    method: 'POST',
    body: JSON.stringify(body),
  });
export const updateTemplate = (id: string, body: UpdateTemplateRequest) =>
  apiFetch<AdminTemplateDto>(`/admin/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
export const deleteResource = (kind: 'perks' | 'learnings' | 'collections' | 'templates', id: string) =>
  apiFetch<void>(`/admin/${kind}/${id}`, { method: 'DELETE' });
