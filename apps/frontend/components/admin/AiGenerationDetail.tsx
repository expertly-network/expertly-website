import type { ReactNode } from 'react';
import Link from 'next/link';
import { Badge, Card } from '@/components/ui';
import { AiGenerationStatusBadge } from '@/components/admin/AiGenerationStatusBadge';
import type { AdminAiGenerationDetailDto, ArticleStatus } from '@shared/article';

const DATETIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const ARTICLE_STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: 'Draft',
  pending_review: 'Pending review',
  published: 'Published',
  rejected: 'Rejected',
};

// Same compact prose styling as the wizard's own "AI DRAFT" preview (AiDraftWizard), plus
// tables — the member can ask the AI to include one ("include a table if relevant").
const DRAFT_BODY_CLASSES =
  'prose-article text-sm leading-[1.7] text-ink-2 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-ink [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:text-ink [&_u]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-bg-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-ink [&_pre]:p-3 [&_pre]:text-bg-card [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_a]:text-accent [&_a]:underline [&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_th]:border [&_th]:border-line [&_th]:bg-bg-alt [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-ink [&_td]:border [&_td]:border-line [&_td]:px-3 [&_td]:py-2';

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-bg-card">
      <header className="border-b border-line px-6 py-4 max-[640px]:px-4">
        <h2 className="text-title text-ink">{title}</h2>
        {description && <p className="mt-1 text-caption text-ink-3">{description}</p>}
      </header>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

// Label stacked above value at every width — inputs are long free text, so a side-by-side
// label column would squeeze them on a phone.
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-6 py-4 max-[640px]:px-4">
      <div className="font-mono text-mono-label uppercase text-ink-3">{label}</div>
      <div className="mt-1.5 text-sm text-ink">{children}</div>
    </div>
  );
}

function TextValue({ value }: { value: string | null }) {
  if (!value?.trim()) return <span className="text-ink-4">Left blank</span>;
  return <p className="whitespace-pre-wrap break-words">{value}</p>;
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="text-ink-3">{label}</span>
      <span className="min-w-0 break-words text-right text-ink">{children}</span>
    </div>
  );
}

// Read-only: what the member gave the "Write with AI" wizard (left/top) next to what the AI
// generated from it. The output shown is the AI's original draft — any later edits or
// "rephrase" passes the member made before saving aren't logged; the linked article (aside)
// is the version they actually saved.
export function AiGenerationDetail({ generation }: { generation: AdminAiGenerationDetailDto }) {
  const { inputs, output } = generation;
  const answeredCount = inputs.followUps.filter((f) => f.answer !== null).length;

  return (
    <div className="flex items-start gap-6 max-[1023px]:flex-col">
      <div className="flex min-w-0 flex-1 flex-col gap-6 max-[1023px]:w-full">
        <Section title="The member's brief" description="Step 1 of the wizard — the core questions every member answers.">
          <Field label="Your thoughts / notes">
            <TextValue value={inputs.notes} />
          </Field>
          <Field label="Recent developments or regulations">
            <TextValue value={inputs.recentDevelopments} />
          </Field>
          <Field label="Advice / comments for readers">
            <TextValue value={inputs.advice} />
          </Field>
        </Section>

        <Section
          title="Follow-up questions"
          description={
            inputs.followUps.length === 0
              ? 'The AI decided the brief was specific enough and asked none.'
              : `The AI asked ${inputs.followUps.length}; the member answered ${answeredCount}.`
          }
        >
          {inputs.followUps.map((f, i) => (
            <Field key={i} label={`Question ${i + 1}`}>
              <p className="font-medium">{f.question}</p>
              <div className="mt-1.5 text-ink-2">
                {f.answer !== null ? (
                  <p className="whitespace-pre-wrap break-words">{f.answer}</p>
                ) : (
                  <span className="text-ink-4">Skipped</span>
                )}
              </div>
            </Field>
          ))}
        </Section>

        <Section title="Source material" description="Links and documents the member gave the AI to work from.">
          <Field label="Links for the AI to research">
            {inputs.sourceLinks.length === 0 ? (
              <span className="text-ink-4">None</span>
            ) : (
              <ul className="flex flex-col gap-1">
                {inputs.sourceLinks.map((url, i) => (
                  <li key={url + i}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline hover:text-ink">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Field>
          <Field label="Uploaded documents">
            {inputs.sourceFiles.length === 0 ? (
              <span className="text-ink-4">None</span>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {inputs.sourceFiles.map((file, i) => (
                  <li key={file.filename + i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="break-all">{file.filename}</span>
                    {file.url ? (
                      <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent underline hover:text-ink">
                        Open
                      </a>
                    ) : (
                      <span className="text-xs text-ink-4">File unavailable</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {inputs.sourceFiles.some((f) => f.url) && (
              <p className="mt-2 text-xs text-ink-3">Links expire after 10 minutes — reload the page for fresh ones.</p>
            )}
          </Field>
        </Section>

        <Section title="Finishing touches" description="Step 3 of the wizard.">
          <Field label="Tone">
            <TextValue value={inputs.tone} />
          </Field>
          <Field label="Include a table if relevant">{inputs.includeVisual ? 'Yes' : 'No'}</Field>
          <Field label="Anything else?">
            <TextValue value={inputs.extraInstructions} />
          </Field>
        </Section>

        <section className="rounded-2xl border border-line bg-bg-card">
          <header className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4 max-[640px]:px-4">
            <h2 className="text-title text-ink">What the AI generated</h2>
            <Badge variant="brand">AI DRAFT</Badge>
          </header>
          {generation.status === 'failed' ? (
            <div className="px-6 py-6 max-[640px]:px-4">
              <p className="text-sm text-ink-2">This attempt failed — nothing was generated.</p>
              {generation.errorMessage && (
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-bg-alt p-3 font-mono text-xs text-ink-2">
                  {generation.errorMessage}
                </pre>
              )}
            </div>
          ) : (
            <div className="divide-y divide-line">
              <div className="px-6 py-5 max-[640px]:px-4">
                <h3 className="text-xl font-semibold tracking-[-0.02em] text-ink">{output.title ?? 'Untitled'}</h3>
                {output.body ? (
                  /* Safe — the backend sanitizes body with the article allowlist before returning it. */
                  <div className={`mt-4 ${DRAFT_BODY_CLASSES}`} dangerouslySetInnerHTML={{ __html: output.body }} />
                ) : (
                  <p className="mt-4 text-sm text-ink-4">No body was recorded.</p>
                )}
              </div>
              <Field label="Services the AI picked">
                {output.services.length > 0 ? output.services.map((s) => s.name).join(', ') : <span className="text-ink-4">None matched</span>}
              </Field>
              <Field label="Countries the AI picked">
                {output.countries.length > 0 ? output.countries.join(', ') : <span className="text-ink-4">None matched</span>}
              </Field>
              <Field label="State / province">
                {output.state ?? <span className="text-ink-4">None implied</span>}
              </Field>
              <Field label="Sources the AI cited">
                {output.sources.length === 0 ? (
                  <span className="text-ink-4">None</span>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {output.sources.map((source, i) => (
                      <li key={source.url + i}>
                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline hover:text-ink">
                          {source.title || source.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </Field>
            </div>
          )}
        </section>
      </div>

      <aside className="sticky top-24 w-[320px] flex-none max-[1023px]:static max-[1023px]:order-first max-[1023px]:w-full">
        <Card padding="md">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-title text-ink">Summary</h2>
            <AiGenerationStatusBadge status={generation.status} />
          </div>
          <div className="mt-3 divide-y divide-line">
            <MetaRow label="Member">{generation.authorName}</MetaRow>
            <MetaRow label="Generated">{DATETIME_FORMAT.format(new Date(generation.createdAt))}</MetaRow>
            <MetaRow label="Provider">{generation.provider ?? '—'}</MetaRow>
            <MetaRow label="Model">
              <span className="font-mono text-xs">{generation.model ?? '—'}</span>
            </MetaRow>
            <MetaRow label="Time taken">
              {generation.latencyMs !== null ? `${(generation.latencyMs / 1000).toFixed(1)}s` : '—'}
            </MetaRow>
          </div>
          <div className="mt-4 rounded-xl bg-bg-alt p-4">
            <div className="font-mono text-mono-label uppercase text-ink-3">Saved as</div>
            {generation.article ? (
              <>
                <Link href={`/articles/${generation.article.id}`} className="mt-1.5 block font-medium text-ink hover:text-accent">
                  {generation.article.title}
                </Link>
                <div className="mt-1 text-xs text-ink-3">{ARTICLE_STATUS_LABEL[generation.article.status]}</div>
                <p className="mt-2 text-xs text-ink-3">
                  The member may have edited or rephrased the draft before saving — compare against the article itself.
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-ink-3">
                Not saved as an article — the member discarded it, regenerated, or hasn&apos;t saved yet.
              </p>
            )}
          </div>
        </Card>
      </aside>
    </div>
  );
}
