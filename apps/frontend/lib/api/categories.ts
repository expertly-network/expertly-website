import { apiFetch } from '@/lib/api/client';
import type { CategoryDto } from '@shared/category';

export function getCategories(): Promise<CategoryDto[]> {
  return apiFetch<CategoryDto[]>('/categories');
}
