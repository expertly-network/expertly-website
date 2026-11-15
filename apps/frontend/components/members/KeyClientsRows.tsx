import { PENDING_VERIFICATION_TOOLTIP } from '@/components/members/VerificationBadge';
import type { MemberKeyClient } from '@shared/member';

// A row only scrolls once it holds at least this many logos; fewer sit still, each shown once.
export const MARQUEE_MIN_LOGOS = 6;

// A small status mark in the card's top-right corner: green tick once verified, the soft yellow circled "i"
// while pending. `title` carries the explanation (a custom tooltip would be clipped by the
// scrolling row).
function StatusMark({ verified }: { verified: boolean }) {
  return (
    <span
      title={verified ? 'Verified by the GrowXQ team.' : PENDING_VERIFICATION_TOOLTIP}
      className={`absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full ${
        verified ? 'bg-accent text-bg-card' : 'bg-warn-soft text-warn'
      }`}
    >
      <span className="sr-only">{verified ? 'Verified' : 'Pending verification'}</span>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        {verified ? (
          <path
            d="M5 12.5l4.5 4.5L19 7"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        )}
      </svg>
    </span>
  );
}

function ClientCard({ client, hidden }: { client: MemberKeyClient; hidden?: boolean }) {
  return (
    <li
      aria-hidden={hidden ? true : undefined}
      className="relative flex min-w-[160px] flex-none items-center gap-3 rounded-panel border border-line bg-bg-card py-2.5 pl-2.5 pr-9 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-shadow hover:border-line-2 hover:shadow-[0_6px_20px_rgba(0,0,0,0.09)]"
    >
      {client.logoUrl ? (
        // Raw <img>: a key-client logo may be a member-entered URL on any host (not only Storage),
        // which next/image's remotePatterns can't allow.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          decoding="async"
          src={client.logoUrl}
          alt=""
          className="h-11 w-11 flex-none rounded-[11px] object-cover"
        />
      ) : (
        // One theme colour for every fallback initial (no rainbow of per-client hues).
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[11px] bg-accent font-mono text-lg font-extrabold text-bg-card">
          {client.name.charAt(0)}
        </span>
      )}
      <StatusMark verified={client.isVerified} />
      <span className="whitespace-nowrap text-[15px] font-semibold leading-[1.25] text-ink">{client.name}</span>
    </li>
  );
}

function ClientRow({ label, clients }: { label: string; clients: MemberKeyClient[] }) {
  if (clients.length === 0) return null;
  const animated = clients.length >= MARQUEE_MIN_LOGOS;
  return (
    <div>
      {animated ? (
        // `.mp-clients-outer` — auto-scrolling marquee, pauses on hover. The list is rendered twice
        // back to back so translateX(-50%) loops seamlessly; the copy is hidden from screen readers.
        <div
          className="group relative overflow-hidden"
          style={{
            maskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
          }}
        >
          <ul
            aria-label={label}
            className="flex w-max animate-marquee gap-2.5 group-hover:[animation-play-state:paused] motion-reduce:animate-none"
          >
            {[...clients, ...clients].map((client, i) => (
              <ClientCard key={`${client.id}-${i}`} client={client} hidden={i >= clients.length} />
            ))}
          </ul>
        </div>
      ) : (
        <ul aria-label={label} className="flex flex-wrap gap-2.5">
          {clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))}
        </ul>
      )}
    </div>
  );
}

/** Every key client in one row; each logo carries its own verified / pending mark. */
export function KeyClientsRows({ clients }: { clients: MemberKeyClient[] }) {
  return <ClientRow label="Key clients" clients={clients} />;
}
