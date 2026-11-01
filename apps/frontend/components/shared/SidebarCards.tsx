import type { ReactNode } from 'react';
import { Button, Card } from '@/components/ui';

// The right-hand sidebar cards shared by the browse pages (Members, Events), so they read the same:
// a stats card (big green figure + short label per row) and the dark "apply" card.

export interface SidebarStat {
  num: string;
  label: ReactNode;
}

export function SidebarStatsCard({ title, intro, stats }: { title: string; intro: string; stats: SidebarStat[] }) {
  return (
    <Card padding="md">
      <h3 className="text-title text-ink">{title}</h3>
      <p className="mt-3 text-sm text-ink-3">{intro}</p>
      <div className="mt-2">
        {stats.map((stat) => (
          <div key={stat.num} className="flex items-start gap-3 border-t border-line py-3.5">
            <div className="w-16 flex-none text-[26px] font-semibold leading-none tracking-[-0.03em] text-accent">
              {stat.num}
            </div>
            <p className="text-[13px] leading-[1.45] text-ink-3">{stat.label}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SidebarJoinCard({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <Card padding="md" className="relative overflow-hidden bg-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklab, var(--accent) 18%, transparent) 0%, transparent 70%)',
        }}
      />
      <span className="relative font-mono text-[9px] font-bold uppercase text-white/40">{eyebrow}</span>
      <h3 className="relative mt-2 text-title text-bg-card">{title}</h3>
      <p className="relative mt-2 text-sm text-white/60">{body}</p>
      <Button href="/apply" variant="secondary-dark" className="relative mt-4" fullWidth>
        Apply for membership →
      </Button>
    </Card>
  );
}
