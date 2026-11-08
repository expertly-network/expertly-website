import Link from 'next/link';

// Phone-width stand-in for a section's "View all" button: a text link on the heading's row, so the
// section doesn't spend a full-width button row on navigation. Pair with a `hidden sm:inline-flex`
// Button for larger screens.
export function MobileViewAll({ href, label = 'View all' }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="-my-2 inline-flex min-h-11 flex-none items-center whitespace-nowrap text-sm font-medium text-accent sm:hidden"
    >
      {label} →
    </Link>
  );
}
