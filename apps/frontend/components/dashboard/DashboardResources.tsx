import Link from 'next/link';

const RESOURCES = [
  {
    title: 'Learnings',
    href: '/learnings',
    detail: 'Build your expertise with courses, reading and learning collections.',
    icon: (
      <>
        <path d="M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 3 9 3 12 0v-5M22 10v7" />
      </>
    ),
  },
  {
    title: 'Templates',
    href: '/templates',
    detail: 'Ready-to-use documents and practical tools for your next engagement.',
    icon: (
      <>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M8 13h8M8 17h6" />
      </>
    ),
  },
  {
    title: 'Perks & Products',
    href: '/perks',
    detail: 'Discover member offers and savings on the tools your practice uses.',
    icon: (
      <>
        <rect x="3" y="8" width="18" height="13" rx="2" />
        <path d="M12 8v13M3 12h18" />
        <path d="M12 8H7a3 3 0 113-3l2 3zm0 0h5a3 3 0 10-3-3l-2 3z" />
      </>
    ),
  },
];

export function DashboardResources() {
  return (
    <section aria-labelledby="dashboard-resources-title">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="dashboard-resources-title" className="text-title text-ink">
          Your resources
        </h2>
        <p className="text-caption text-ink-3">Make the most of your membership</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {RESOURCES.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group flex min-w-0 flex-col rounded-card border border-line bg-bg-card p-6 transition-colors hover:border-accent"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-neon text-accent-2"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {r.icon}
              </svg>
            </span>
            <h3 className="mt-5 text-title text-ink group-hover:text-accent">{r.title}</h3>
            <p className="mb-5 mt-2 text-sm text-ink-3">{r.detail}</p>
            <span className="mt-auto text-sm font-medium text-accent">Explore →</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

// Matching and scheduled peer sessions are not live yet. Keep the discovery action useful.
export function DashboardPeerNetwork() {
  return (
    <section
      className="relative overflow-hidden rounded-card border border-accent/25 bg-neon/60 p-6 sm:p-8"
      aria-labelledby="dashboard-peer-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-caption font-semibold text-accent-2">Peer network</span>
        <span className="rounded-full border border-line bg-bg-card px-3 py-1 text-caption text-ink-3">
          Peer Connect · Coming soon
        </span>
      </div>
      <h2 id="dashboard-peer-title" className="font-brand mt-5 text-heading text-ink">
        Connect with peers who get your practice.
      </h2>
      <p className="mt-3 max-w-xl text-sm text-ink-3">
        Trade perspectives, find expertise outside your scope, and get to know verified finance and legal professionals
        across the network.
      </p>
      <Link href="/members" className="mt-5 inline-flex text-sm font-semibold text-accent hover:underline">
        Explore your peer network →
      </Link>
    </section>
  );
}
