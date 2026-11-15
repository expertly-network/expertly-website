'use client';

import { useState, type ReactNode } from 'react';
import { FormattedText, countTextItems } from '@/components/shared/FormattedText';
import { groupByCompany, groupPeriod, rolePeriod } from '@/lib/members/work-history';

// The profile PDF renders this same timeline (components/members/pdf/MemberProfilePdf.tsx) from the
// same helpers — change both together (see apps/frontend/CLAUDE.md).
import type { MemberWorkExperience } from '@shared/member';

// Collapsed, a role shows its first few bullets / paragraphs whole; "Show more" reveals the rest.
// Never a half-clipped line.
const COLLAPSED_ITEMS = 3;

function Description({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = countTextItems(text) > COLLAPSED_ITEMS;

  return (
    <div className="mt-2 text-caption leading-relaxed text-ink-3">
      <FormattedText text={text} className="gap-2" maxItems={expanded ? undefined : COLLAPSED_ITEMS} />
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-1 block w-full text-right font-medium text-accent hover:underline"
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
  companyBadge,
  roleActions,
  companyFooter,
}: {
  works: MemberWorkExperience[];
  /** Owner only: shows "Add a description" on roles without one. */
  onAddDescription?: (role: MemberWorkExperience) => void;
  /** Right of the company name: one verification badge for the company (all of its roles verified). */
  companyBadge?: (roles: MemberWorkExperience[]) => ReactNode;
  /** Beside each role's title: the owner's Edit button. */
  roleActions?: (role: MemberWorkExperience) => ReactNode;
  /** Below a company: e.g. messages from the GrowXQ team (owner only). */
  companyFooter?: (roles: MemberWorkExperience[]) => ReactNode;
}) {
  const addDescription = (role: MemberWorkExperience) =>
    onAddDescription && (
      <button
        type="button"
        onClick={() => onAddDescription(role)}
        className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-accent hover:underline"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        Add a description
      </button>
    );

  return (
    // No cards and no rail through the whole list: companies are separated by a thin line. Like
    // LinkedIn, every role, even a company's only one, hangs on a vertical line with a dot.
    <ol className="divide-y divide-line">
      {groupByCompany(works).map((group) => {
        // Company and overall period, then each role with its own title, period and description.
        const multiple = group.roles.length > 1;
        const roleList = group.roles.map((role) => (
          <li key={role.id} className="relative pb-4 last:pb-0">
            <span
              aria-hidden="true"
              className="absolute -left-[22px] top-[5px] h-2.5 w-2.5 rounded-full border-2 border-bg-card bg-accent shadow-[0_0_0_1px_var(--line)]"
            />
            <div className="flex items-start justify-between gap-2 max-[480px]:flex-col max-[480px]:gap-1">
              <div className="min-w-0 text-profile-item font-medium text-ink">{role.title}</div>
              <div className="flex flex-none items-center gap-2">
                {multiple && <Period {...rolePeriod(role)} />}
                {roleActions?.(role)}
              </div>
            </div>
            {role.description ? <Description text={role.description} /> : addDescription(role)}
          </li>
        ));
        return (
          <li key={group.roles[0].id} className="py-5 first:pt-0 last:pb-0">
            <div>
              <div className="flex items-start justify-between gap-2 max-[480px]:flex-col max-[480px]:gap-1">
                <div className="min-w-0">
                  <div className="text-title font-semibold text-ink">{group.company}</div>
                  {multiple && <div className="mt-0.5 text-profile-meta text-ink-3">{group.roles.length} roles</div>}
                </div>
                <div className="flex flex-none items-center gap-2">
                  <Period {...groupPeriod(group.roles)} />
                  {companyBadge?.(group.roles)}
                </div>
              </div>
              {companyFooter?.(group.roles)}
              <div className="mt-3">
                <ol className="ml-[5px] border-l-2 border-line pl-4">{roleList}</ol>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
