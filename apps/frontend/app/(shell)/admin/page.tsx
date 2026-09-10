import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSessionUser } from '@/lib/auth/session-claims';
import { PageContainer } from '@/components/layout/PageContainer';
import { Eyebrow } from '@/components/ui';

export const metadata = {
  title: 'Admin — Expertly',
};

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className: 'shrink-0',
};

const APPLICATIONS_ICON = (
  <path d="M12 2L3 6v6c0 5 3.8 8.5 9 10 5.2-1.5 9-5 9-10V6l-9-4zM9 12l2 2 4-4" />
);
const EVENTS_ICON = <path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4zM16 2v4M8 2v4M3 10h18" />;
const ARTICLES_ICON = (
  <>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
    <path d="M9 13l2 2 4-4" />
  </>
);

// Each destination is separately permission-gated by the backend.
const ADMIN_SECTIONS = [
  {
    href: '/admin/applications',
    icon: APPLICATIONS_ICON,
    title: 'Membership applications',
    description: 'Review, approve, or reject applications to become a vetted member.',
  },
  {
    href: '/admin/articles',
    icon: ARTICLES_ICON,
    title: 'Review articles',
    description: 'Approve or reject articles submitted for editorial review.',
  },
  {
    href: '/admin/events',
    icon: EVENTS_ICON,
    title: 'Events',
    description: 'Add, edit, publish, and remove events on the community calendar.',
  },
];

// No design mockup exists for this hub; styled to match other admin pages.
export default async function AdminPage() {
  const profile = await getSessionUser();
  if (!profile) {
    redirect('/login?returnTo=/admin');
  }
  if (profile.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div>
      <section className="bg-ink py-16">
        <PageContainer>
          <Eyebrow dark>Admin</Eyebrow>
          <h1 className="mt-2 text-headline text-bg-card">Admin</h1>
          <p className="mt-3 max-w-xl text-lede text-white/65">
            Manage membership applications, the events calendar, and article submissions.
          </p>
        </PageContainer>
      </section>
      <section className="py-12">
        <PageContainer>
          <div className="grid grid-cols-3 gap-5 max-[900px]:grid-cols-1">
            {ADMIN_SECTIONS.map((section) => (
              <Link
                key={section.href}
                href={section.href}
                className="group block rounded-card border border-line bg-bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all duration-150 hover:-translate-y-1 hover:border-accent hover:shadow-[0_16px_32px_-18px_rgba(0,0,0,0.22)] active:translate-y-0 active:shadow-[0_2px_6px_-2px_rgba(0,0,0,0.15)] active:duration-75"
              >
                <svg
                  {...ICON_PROPS}
                  className="shrink-0 text-ink-2 transition-[transform,color] duration-150 group-hover:scale-110 group-hover:text-accent"
                >
                  {section.icon}
                </svg>
                <h2 className="mt-4 text-title text-ink">{section.title}</h2>
                <p className="mt-1.5 text-sm text-ink-3">{section.description}</p>
              </Link>
            ))}
          </div>
        </PageContainer>
      </section>
    </div>
  );
}
