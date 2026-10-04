import { Badge } from '@/components/ui';
import type { AiGenerationStatus } from '@shared/article';

// Shared by the AI-generations log table and its detail page so both chips always agree.
export function AiGenerationStatusBadge({ status }: { status: AiGenerationStatus }) {
  return status === 'success' ? <Badge variant="success">Generated</Badge> : <Badge variant="danger">Failed</Badge>;
}
