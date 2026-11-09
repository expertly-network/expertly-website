'use client';

import { useState } from 'react';
import { Badge, Button, Card, Textarea } from '@/components/ui';
import { SectionEditModal } from '@/components/members/edit/SectionEditModal';
import type { MemberDto, MemberEditSection } from '@shared/member';
import type { MyInterviewDto } from '@shared/interview';
import { updateInterviewSummary } from '@/lib/api/interviews';
import { interviewErrorMessage } from './interview-errors';

type Row = Record<string, unknown>;

export function InterviewResults({
  interview,
  member,
  onChanged,
}: {
  interview: MyInterviewDto;
  member: MemberDto;
  onChanged: () => void;
}) {
  const drafts = interview.drafts ?? {};
  const [summary, setSummary] = useState(interview.summary ?? '');
  const [saving, setSaving] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [open, setOpen] = useState<{ section: MemberEditSection; prefill: Row | Row[] } | null>(null);
  const [submitted, setSubmitted] = useState<MemberEditSection[]>([]);
  const hidden = interview.summaryStatus === 'hidden';

  async function saveSummary(approve: boolean) {
    setSaving(true);
    setSummaryError(null);
    try {
      await updateInterviewSummary({ summary, approve });
      onChanged();
    } catch (e: unknown) {
      setSummaryError(interviewErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const sections: { section: MemberEditSection; title: string; detail: string; prefill: Row | Row[] }[] = [];
  if (drafts.headlineBio)
    sections.push({
      section: 'headline_bio',
      title: 'Headline & bio',
      detail: drafts.headlineBio.headline,
      prefill: { ...drafts.headlineBio },
    });
  if (drafts.engagements?.length)
    sections.push({
      section: 'engagements',
      title: 'Key engagements',
      detail: `${drafts.engagements.length} new engagement${drafts.engagements.length > 1 ? 's' : ''}`,
      prefill: drafts.engagements.map((e) => ({
        title: e.title,
        organization: e.organization,
        clientName: e.clientName ?? '',
        year: e.year,
      })),
    });
  if (drafts.keyClients?.length)
    sections.push({
      section: 'key_clients',
      title: 'Key clients',
      detail: drafts.keyClients.map((c) => c.name).join(', '),
      prefill: drafts.keyClients.map((c) => ({ name: c.name })),
    });

  return (
    <div className="mx-auto w-full max-w-[880px] space-y-8">
      <div>
        <p className="text-eyebrow uppercase tracking-wide text-accent">Expert interview</p>
        <h1 className="mt-2 text-heading text-ink">Your interview results</h1>
        <p className="mt-2 text-ink-3">
          Review the drafts below. Nothing changes on your profile until you submit and our team approves.
        </p>
      </div>

      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-title text-ink">Search summary</h2>
          <Badge variant={interview.summaryStatus === 'approved' ? 'success' : hidden ? 'neutral' : 'warning'}>
            {interview.summaryStatus === 'approved' ? 'Approved' : hidden ? 'Hidden by GrowXQ' : 'Needs your approval'}
          </Badge>
        </div>
        <div className="mt-4">
          <Textarea
            label="Your expertise, in a few sentences"
            hint="Used by GrowXQ search to match you with the right clients, and may be quoted in search answers. Edit anything that isn’t right."
            rows={6}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={1500}
            disabled={hidden}
            error={summaryError ?? undefined}
          />
        </div>
        {!hidden && (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button variant="secondary" disabled={saving} onClick={() => void saveSummary(false)}>
              Save draft
            </Button>
            <Button disabled={saving || summary.trim().length < 20} onClick={() => void saveSummary(true)}>
              Approve for search
            </Button>
          </div>
        )}
      </Card>

      <section>
        <h2 className="text-title text-ink">Profile drafts</h2>
        {sections.length === 0 ? (
          <p className="mt-3 text-sm text-ink-3">
            The interview didn’t surface anything new for your profile sections.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {sections.map((s) => (
              <li key={s.section}>
                <Card padding="md" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-ink">{s.title}</p>
                    <p className="truncate text-sm text-ink-3">{s.detail}</p>
                  </div>
                  {submitted.includes(s.section) ? (
                    <Badge variant="warning">Submitted for review</Badge>
                  ) : (
                    <Button variant="secondary" onClick={() => setOpen({ section: s.section, prefill: s.prefill })}>
                      Review & submit
                    </Button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SectionEditModal
        member={member}
        section={open?.section ?? null}
        prefill={open?.prefill}
        onClose={() => setOpen(null)}
        onSubmitted={() => {
          if (open) setSubmitted((prev) => [...prev, open.section]);
          setOpen(null);
        }}
      />
    </div>
  );
}
