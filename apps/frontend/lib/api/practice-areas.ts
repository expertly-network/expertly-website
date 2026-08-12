import { apiFetch } from '@/lib/api/client';
import type { PracticeAreaDto } from '@shared/practice-area';

export function getPracticeAreas(): Promise<PracticeAreaDto[]> {
  return apiFetch<PracticeAreaDto[]>('/practice-areas');
}
