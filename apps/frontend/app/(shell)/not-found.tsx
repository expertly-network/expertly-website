import { NotFoundContent } from '@/components/shared/NotFoundContent';

export const metadata = { title: 'Page not found — GrowXQ' };

// notFound() from any (shell) page (unknown member slug, article id, …) — rendered inside the
// shell so the sidebar nav is still there.
export default function ShellNotFound() {
  return <NotFoundContent />;
}
