import { Button } from '@/components/ui';

// Shared body for both 404 pages: the in-shell one (keeps the sidebar nav) and the root one
// (unmatched URLs, rendered without the shell — so it carries its own way home).
export function NotFoundContent() {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center px-4 py-24 text-center">
      <span className="text-mono-label text-accent">404</span>
      <h1 className="mt-4 text-heading text-ink">This page doesn&apos;t exist.</h1>
      <p className="mt-3 text-lede text-ink-3">
        The link may be broken, or the page may have been moved or unpublished.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button href="/">Go to the homepage</Button>
        <Button href="/members" variant="secondary">
          Browse members
        </Button>
      </div>
    </div>
  );
}
