import type { CSSProperties, ReactNode } from 'react';

// The illustrative product mocks beside each benefit on /membership (design/static_html/
// membership.html's .mock-* panels). Sample people and content only — no live counts or partner
// names, which the prototype invented. Rows animate in via the .mb-row/.mb-type classes in
// globals.css; `delay` staggers them.

function row(delay: number): CSSProperties {
  return { animationDelay: `${delay}s` };
}

function WindowDots() {
  return (
    <div aria-hidden="true" className="mb-4 flex gap-1.5">
      <span className="h-[9px] w-[9px] rounded-full bg-line-2" />
      <span className="h-[9px] w-[9px] rounded-full bg-line-2" />
      <span className="h-[9px] w-[9px] rounded-full bg-line-2" />
    </div>
  );
}

function Avatar({ initials, small = false }: { initials: string; small?: boolean }) {
  return (
    <span
      className={`flex flex-none items-center justify-center rounded-full bg-neon font-semibold text-accent-2 ${small ? 'h-6 w-6 text-[9px]' : 'h-10 w-10 text-xs'}`}
    >
      {initials}
    </span>
  );
}

function Verified() {
  return <span className="ml-1.5 whitespace-nowrap font-semibold text-accent">✓ Verified</span>;
}

function MockFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden="true" className={`rounded-card border border-line bg-bg-card p-5 sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

function PersonRow({
  initials,
  name,
  meta,
  action,
  delay,
}: {
  initials: string;
  name: string;
  meta: string;
  action: string;
  delay: number;
}) {
  return (
    <div className="mb-row flex items-center gap-3 rounded-panel border border-line p-3.5" style={row(delay)}>
      <Avatar initials={initials} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{name}</div>
        <div className="truncate text-caption text-ink-3">
          {meta}
          <Verified />
        </div>
      </div>
      <span className="flex-none rounded-lg bg-ink px-3.5 py-2 text-xs font-medium text-bg">{action}</span>
    </div>
  );
}

export function SearchMock() {
  return (
    <MockFrame>
      <WindowDots />
      <div className="flex items-center gap-2.5 rounded-panel bg-neon px-4 py-3 text-sm text-ink-2">
        <span className="h-1.5 w-1.5 flex-none animate-pulse rounded-full bg-accent" />
        <span className="mb-type min-w-0 max-w-full">Transfer pricing specialist in Singapore</span>
        <span className="h-3.5 w-px flex-none animate-pulse bg-accent" />
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        <PersonRow
          initials="PK"
          name="Priya Krishnaswamy"
          meta="Tax Partner · Singapore"
          action="Connect"
          delay={1.4}
        />
        <PersonRow initials="RM" name="Rohan Mehta" meta="M&A Counsel · London" action="Connect" delay={2} />
        <div className="mb-row flex gap-3 rounded-panel border border-accent/30 bg-neon p-3.5" style={row(2.8)}>
          <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-accent" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink">New consultation request</div>
            <p className="mt-0.5 text-caption text-ink-3">
              “Need cross-border tax advice on our Singapore holding structure — available this week?”
            </p>
          </div>
        </div>
      </div>
    </MockFrame>
  );
}

export function ArticleMock() {
  return (
    <MockFrame className="overflow-hidden !p-0">
      <div className="relative h-[150px] bg-bg-alt">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice">
          <path
            d="M20 95 Q60 60 110 75 T210 60 T310 80 T390 55"
            stroke="var(--ink)"
            strokeOpacity="0.14"
            strokeWidth="1.4"
            fill="none"
          />
          <path
            d="M10 120 Q80 90 150 105 T290 95 T400 110"
            stroke="var(--accent)"
            strokeOpacity="0.35"
            strokeWidth="1.4"
            fill="none"
          />
          <circle cx="110" cy="75" r="3.5" fill="var(--accent)" />
          <circle cx="210" cy="60" r="3" fill="var(--ink)" fillOpacity="0.35" />
          <circle cx="310" cy="80" r="3" fill="var(--ink)" fillOpacity="0.35" />
          <circle cx="150" cy="105" r="2.5" fill="var(--accent)" fillOpacity="0.6" />
          <g transform="translate(320,22)">
            <rect width="52" height="66" rx="6" fill="var(--bg-card)" stroke="var(--ink)" strokeOpacity="0.16" />
            <line x1="10" y1="16" x2="42" y2="16" stroke="var(--ink)" strokeOpacity="0.25" strokeWidth="2" />
            <line x1="10" y1="26" x2="34" y2="26" stroke="var(--ink)" strokeOpacity="0.18" strokeWidth="2" />
            <text x="26" y="52" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--accent)">
              %
            </text>
          </g>
        </svg>
        <span className="absolute bottom-3.5 left-4 rounded-md bg-ink px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-bg">
          Transfer pricing
        </span>
      </div>
      <div className="p-5 sm:p-6">
        <h4 className="font-brand text-[22px] font-semibold leading-tight text-ink">
          BEPS 2.0 and what multinationals need to rethink now
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          Pillar Two is live. What the global minimum tax means for cross-border structures — and the three questions
          every CFO should be asking their advisors.
        </p>
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-caption text-ink-3">
          <Avatar initials="DM" small />
          Diego Martinez · Madrid
        </div>
      </div>
    </MockFrame>
  );
}

export function PeersMock() {
  return (
    <MockFrame>
      <WindowDots />
      <div className="flex flex-col gap-2.5">
        <PersonRow
          initials="SK"
          name="Sunita Krishnamurthy"
          meta="M&A Partner · Mumbai"
          action="Book 1:1"
          delay={0.4}
        />
        <PersonRow initials="OA" name="Oluwaseun Adeyemi" meta="Capital Markets · Lagos" action="Book 1:1" delay={1} />
        <PersonRow initials="LP" name="Lena Pavlova" meta="Tax Disputes · Zurich" action="Book 1:1" delay={1.6} />
      </div>
    </MockFrame>
  );
}

const DEALS: [string, string[]][] = [
  ['AI & drafting', ['Research assistants', 'Drafting tools']],
  ['Legal research', ['Case law', 'Regulatory databases']],
  ['Finance & tax', ['Accounting', 'Market data']],
  ['Productivity', ['Notes', 'Scheduling', 'Video calls']],
];

export function DealsMock() {
  return (
    <MockFrame>
      <WindowDots />
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">Member deals</span>
        <span className="rounded-full bg-neon px-2.5 py-1 text-[11px] font-semibold text-accent-2">Coming soon</span>
      </div>
      <div className="flex flex-col divide-y divide-line">
        {DEALS.map(([category, chips], i) => (
          <div key={category} className="mb-row flex flex-wrap items-center gap-2 py-3" style={row(0.4 + i * 0.5)}>
            <span className="w-full text-caption font-medium text-ink-2 sm:w-[120px]">{category}</span>
            {chips.map((chip) => (
              <span key={chip} className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-3">
                {chip}
              </span>
            ))}
          </div>
        ))}
      </div>
    </MockFrame>
  );
}

const CHANNELS: [string, number][] = [
  ['international-tax', 24],
  ['mergers-acquisitions', 18],
  ['gst-vat-compliance', 9],
  ['corporate-law', 15],
];

export function DiscussionsMock() {
  return (
    <MockFrame>
      <WindowDots />
      <div className="mb-2 text-sm font-medium text-ink">Discussion groups</div>
      <div className="flex flex-col">
        {CHANNELS.map(([name, count], i) => (
          <div
            key={name}
            className={`mb-row flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${i === 0 ? 'bg-neon text-ink' : 'text-ink-2'}`}
            style={row(0.3 + i * 0.35)}
          >
            <span className="text-ink-4">#</span>
            <span className="flex-1 truncate">{name}</span>
            <span className="rounded-full bg-ink-2 px-1.5 text-[10px] font-semibold text-bg">{count}</span>
          </div>
        ))}
      </div>
      <div className="mb-row mt-3 flex flex-col gap-3 rounded-panel border border-line p-3.5" style={row(2)}>
        <div className="flex gap-2.5 text-sm font-medium text-ink">
          <Avatar initials="AK" small />
          How does Pillar Two affect Singapore holding structures post-2025?
        </div>
        <div className="flex gap-2.5 text-caption text-ink-3">
          <Avatar initials="PK" small />
          <span>
            <span className="mr-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-bg">Expert</span>
            Under the 15% minimum tax rules, the key issue is top-up tax exposure at the Singapore level…
          </span>
        </div>
      </div>
    </MockFrame>
  );
}

const EVENTS: [string, string, string][] = [
  ['23 JUN', 'Global M&A Roundtable', 'London · UK'],
  ['25 JUN', 'Compliance Leaders Forum', 'New York · US'],
  ['30 JUN', 'Capital Markets Outlook H2', 'Hong Kong · HK'],
];

export function EventsMock() {
  return (
    <MockFrame className="!p-0">
      <div className="border-b border-line px-5 py-4 text-caption font-medium text-ink-2 sm:px-6">
        Upcoming member events
      </div>
      {EVENTS.map(([date, title, place], i) => (
        <div
          key={title}
          className="mb-row flex items-center gap-4 border-b border-line px-5 py-4 last:border-b-0 sm:px-6"
          style={row(0.4 + i * 0.5)}
        >
          <span className="w-[52px] flex-none text-xs font-semibold text-accent">{date}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-ink">{title}</div>
            <div className="text-caption text-ink-3">{place}</div>
          </div>
          <span className="flex-none rounded-full border border-accent/30 bg-neon px-2.5 py-1 text-[11px] font-semibold text-accent-2 max-[400px]:hidden">
            Members only
          </span>
        </div>
      ))}
    </MockFrame>
  );
}
