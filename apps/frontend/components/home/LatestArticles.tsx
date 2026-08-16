import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SEED_ARTICLES, findMember } from '@/lib/design-seed-data';

// Ported from home.js's initLatestArticles: first article featured large, next 4 as a list.
// Links go to /articles/[id] — that route doesn't exist yet (docs/build-prompts.md session
// 2), so these are inert until then, same as elsewhere on this page.
export function LatestArticles() {
  const [featured, ...rest] = SEED_ARTICLES;
  const featuredAuthor = findMember(featured.author);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Link href={`/articles/${featured.id}`} className="block">
        <Card padding="md" className="h-full overflow-hidden !p-0">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={featured.image} alt="" className="h-[220px] w-full object-cover" />
            <div className="absolute left-4 top-4">
              <Badge variant="emphasis">{featured.category}</Badge>
            </div>
          </div>
          <div className="p-6">
            <div className="font-mono text-[11px] tracking-[0.1em] text-ink-3">
              {featured.date} · {featured.readTime} read
            </div>
            <h3 className="mt-2 text-title text-ink">{featured.title}</h3>
            {featuredAuthor && (
              <div className="mt-5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featuredAuthor.img} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div>
                  <div className="text-sm font-medium text-ink">{featuredAuthor.name}</div>
                  <div className="font-mono text-[11px] text-ink-3">
                    {featuredAuthor.title}, {featuredAuthor.firm}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </Link>

      <div className="flex flex-col divide-y divide-line">
        {rest.map((a, i) => {
          const author = findMember(a.author);
          return (
            <Link key={a.id} href={`/articles/${a.id}`} className="flex gap-4 py-4">
              <div className="font-mono text-sm text-ink-4">0{i + 2}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="neutral">{a.category}</Badge>
                  <span className="font-mono text-[10px] tracking-[0.08em] text-ink-3">
                    {a.readTime} · {a.date}
                  </span>
                </div>
                <h4 className="mt-1.5 text-sm font-medium text-ink">{a.title}</h4>
                {author && (
                  <div className="mt-2 flex items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={author.img} alt="" className="h-6 w-6 rounded-full object-cover" />
                    <span className="text-xs text-ink-2">{author.name}</span>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
