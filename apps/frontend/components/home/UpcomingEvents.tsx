import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SEED_EVENTS } from '@/lib/design-seed-data';

// Real event data (design/static_html/assets/members.js's EXPERTLY_EVENTS), but NOT the
// design's actual homepage widget — index.html shows a full interactive month calendar grid
// (.home-calendar, prev/next navigation, day cells mapping to events) here, which wasn't
// built given its size; this is a simpler card list of the same underlying events instead.
// Flagged, not silently downgraded — build-prompts.md session 10 covers the real Events
// backend this would eventually read from.
export function UpcomingEvents() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {SEED_EVENTS.map((e) => (
        <Link key={e.id} href={`/events#${e.id}`} className="block">
          <Card padding="md" className="flex h-full gap-4">
            <div className="flex-none text-center">
              <div className="font-mono text-[11px] tracking-[0.1em] text-accent">{e.start.split(' ')[0]}</div>
              <div className="text-xl font-semibold text-ink">{e.start.split(' ')[1]}</div>
            </div>
            <div className="min-w-0 border-l border-line pl-4">
              <div className="flex items-center gap-1.5">
                <Badge variant="neutral">{e.category}</Badge>
                <span className="text-[11px] font-medium text-ok">{e.format}</span>
              </div>
              <h4 className="mt-1.5 text-sm font-medium text-ink">{e.title}</h4>
              <p className="mt-1 line-clamp-2 text-xs text-ink-3">{e.desc}</p>
              <div className="mt-2 text-[11px] text-ink-3">
                {e.city}, {e.country}
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
