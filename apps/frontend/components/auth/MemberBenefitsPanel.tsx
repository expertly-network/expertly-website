const BENEFITS = [
  {
    title: 'Verified Credentials',
    body: 'LinkedIn login confirms your professional history to maintain network integrity.',
    icon: (
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    ),
  },
  {
    title: 'Seamless Data Sync',
    body: 'Automatically pre-fill and update your profile details directly from your LinkedIn profile.',
    icon: (
      <>
        <path d="M23 4v6h-6M1 20v-6h6" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </>
    ),
  },
  {
    title: 'Privacy First',
    body: 'Expertly never stores your password. Your data is used solely for verification.',
    icon: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </>
    ),
  },
];

export function MemberBenefitsPanel() {
  return (
    <div className="mt-7 border-t border-line pt-6">
      <div className="mb-5">
        <span className="inline-block rounded-full bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-accent">
          Verified Expert Network
        </span>
      </div>
      <ul className="flex flex-col gap-4">
        {BENEFITS.map((benefit) => (
          <li key={benefit.title} className="flex items-start gap-3">
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-line-2 bg-bg-alt">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                {benefit.icon}
              </svg>
            </div>
            <div className="flex flex-col">
              <strong className="text-[13.5px] font-semibold text-ink">{benefit.title}</strong>
              <span className="text-xs leading-[1.45] text-ink-3">{benefit.body}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
