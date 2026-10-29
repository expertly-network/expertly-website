import { Logo } from '@/components/Logo';
import { NotFoundContent } from '@/components/shared/NotFoundContent';

export const metadata = { title: 'Page not found — GrowXQ' };

// URLs that match no route at all render here, outside the (shell) layout — hence the logo.
export default function RootNotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-bg">
      <Logo variant="auth" className="absolute left-8 top-8" />
      <NotFoundContent />
    </main>
  );
}
