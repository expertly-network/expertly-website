import type { MemberKeyClient } from '@shared/member';

// Cycled by index, same palette design/static_html/member-profile.html uses for a Key Client's
// fallback initial-letter icon when it has no logoUrl.
const CLIENT_ICON_COLORS = [
  '#0A66C2',
  '#F97316',
  '#00A682',
  '#7C3AED',
  '#DC2626',
  '#0891B2',
  '#B45309',
  '#1D4ED8',
  '#9333EA',
  '#DB2777',
];

// A row only scrolls once it holds at least this many logos; fewer sit still, each shown once.
export const MARQUEE_MIN_LOGOS = 6;

function ClientCard({ client, colorIndex, hidden }: { client: MemberKeyClient; colorIndex: number; hidden?: boolean }) {
  return (
    <li
      aria-hidden={hidden ? true : undefined}
      className="flex min-w-[160px] flex-none items-center gap-3 rounded-panel border border-line bg-bg-card py-2.5 pl-2.5 pr-[18px] shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:border-line-2 hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]"
    >
      {client.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          decoding="async"
          src={client.logoUrl}
          alt=""
          className="h-11 w-11 flex-none rounded-[11px] object-cover"
        />
      ) : (
        <span
          className="flex h-11 w-11 flex-none items-center justify-center rounded-[11px] font-mono text-lg font-extrabold text-bg-card"
          style={{ background: CLIENT_ICON_COLORS[colorIndex % CLIENT_ICON_COLORS.length] }}
        >
          {client.name.charAt(0)}
        </span>
      )}
      <span className="whitespace-nowrap text-[15px] font-semibold leading-[1.25] text-ink">{client.name}</span>
    </li>
  );
}

function ClientRow({ label, clients, offset }: { label: string; clients: MemberKeyClient[]; offset: number }) {
  if (clients.length === 0) return null;
  const animated = clients.length >= MARQUEE_MIN_LOGOS;
  return (
    <div>
      <div className="mb-2 font-mono text-[10px] font-semibold uppercase text-ink-3">
        {label} ({clients.length})
      </div>
      {animated ? (
        // `.mp-clients-outer` — auto-scrolling marquee, pauses on hover. The list is rendered twice
        // back to back so translateX(-50%) loops seamlessly; the copy is hidden from screen readers.
        <div
          className="group relative overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, #000 8%, #000 92%, transparent 100%)',
          }}
        >
          <ul
            aria-label={label}
            className="flex w-max animate-marquee gap-2.5 group-hover:[animation-play-state:paused] motion-reduce:animate-none"
          >
            {[...clients, ...clients].map((client, i) => (
              <ClientCard
                key={`${client.id}-${i}`}
                client={client}
                colorIndex={offset + (i % clients.length)}
                hidden={i >= clients.length}
              />
            ))}
          </ul>
        </div>
      ) : (
        <ul aria-label={label} className="flex flex-wrap gap-2.5">
          {clients.map((client, i) => (
            <ClientCard key={client.id} client={client} colorIndex={offset + i} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Verified and unverified key clients, one row each (a row is omitted when empty). */
export function KeyClientsRows({ clients }: { clients: MemberKeyClient[] }) {
  const verified = clients.filter((c) => c.isVerified);
  const unverified = clients.filter((c) => !c.isVerified);
  return (
    <div className="flex flex-col gap-4">
      <ClientRow label="Verified clients" clients={verified} offset={0} />
      <ClientRow label="Unverified clients" clients={unverified} offset={verified.length} />
    </div>
  );
}
