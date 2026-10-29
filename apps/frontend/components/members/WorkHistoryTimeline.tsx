'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { FormattedText } from '@/components/shared/FormattedText';
import { groupByCompany, groupPeriod, rolePeriod } from '@/lib/members/work-history';

// The profile PDF renders this same timeline (components/members/pdf/MemberProfilePdf.tsx) from the
// same helpers — change both together (see apps/frontend/CLAUDE.md).
import type { MemberWorkExperience } from '@shared/member';

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const clampRef = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = clampRef.current;
    if (!el) return;
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className="mt-2 text-caption leading-relaxed text-ink-3">
      {expanded ? (
        <FormattedText text={text} className="gap-2" />
      ) : (
        <p ref={clampRef} className="line-clamp-3 whitespace-pre-line">
          {text}
        </p>
      )}
      {(expanded || overflows) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 font-medium text-accent hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function Period({ range, duration }: { range: string; duration: string | null }) {
  return (
    <div className="flex-none whitespace-nowrap text-profile-meta text-ink-3">
      {range}
      {duration && <span className="text-ink-4"> · {duration}</span>}
    </div>
  );
}

export function WorkHistoryTimeline({
  works,
  onAddDescription,
}: {
  works: MemberWorkExperience[];
  /** Owner only: shows "Add a description" on roles without one. */
  onAddDescription?: () => void;
}) {
  const addDescription = onAddDescription && (
    <button
      type="button"
      onClick={onAddDescription}
      className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-accent hover:underline"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      Add a description
    </button>
  );

  return (
    // `.mp-timeline` — vertical rule with an accent dot per company, each in its own card.
    <ol className="ml-[5px] border-l-2 border-line pl-4">
      {groupByCompany(works).map((group) => {
        const single = group.roles.length === 1;
        return (
          <li key={group.roles[0].id} className="relative mb-5 last:mb-0">
            <span
              aria-hidden="true"
              className="absolute -left-[22px] top-[18px] h-2.5 w-2.5 rounded-full border-2 border-bg-card bg-accent shadow-[0_0_0_1px_var(--line)]"
            />
            <div className="rounded-panel border border-line bg-bg-card p-4 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
              {single ? (
                <>
                  <div className="flex items-start justify-between gap-2 max-[480px]:flex-col max-[480px]:gap-1">
                    <div className="min-w-0">
                      <div className="text-profile-item font-semibold text-ink">{group.roles[0].title}</div>
                      <div className="mt-0.5 text-profile-meta text-ink-3">{group.company}</div>
                    </div>
                    <Period {...rolePeriod(group.roles[0])} />
                  </div>
                  {group.roles[0].description ? <Description text={group.roles[0].description} /> : addDescription}
                </>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 max-[480px]:flex-col max-[480px]:gap-1">
                    <div className="min-w-0">
                      <div className="text-profile-item font-semibold text-ink">{group.company}</div>
                      <div className="mt-0.5 text-profile-meta text-ink-3">{group.roles.length} roles</div>
                    </div>
                    <Period {...groupPeriod(group.roles)} />
                  </div>
                  <ol className="mt-3 flex flex-col gap-4 border-t border-line pt-3">
                    {group.roles.map((role) => (
                      <li key={role.id}>
                        <div className="flex items-start justify-between gap-2 max-[480px]:flex-col max-[480px]:gap-1">
                          <div className="min-w-0 text-profile-item font-medium text-ink">{role.title}</div>
                          <Period {...rolePeriod(role)} />
                        </div>
                        {role.description ? <Description text={role.description} /> : addDescription}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
