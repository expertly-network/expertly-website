'use client';

import { Fragment, useRef, useState, type ReactNode } from 'react';
import { Input, MultiSelect, Select, Textarea } from '@/components/ui';
import { ErrorBanner } from '@/components/auth/ErrorBanner';
import { WriteCard } from '@/components/articles/WriteCard';
import { WriteSubmitButton } from '@/components/articles/WriteSubmitButton';
import { generateArticleDraft, refineArticleDraft } from '@/lib/api/articles';
import { ApiError } from '@/lib/api/client';
import { ALL_COUNTRIES } from '@/lib/members/countries';
import type { PracticeAreaDto } from '@shared/practice-area';

type SubStep = 1 | 2 | 3;

const TONES = ['Practical & accessible', 'Formal & technical', 'Concise briefing', 'Casual & conversational'];

const AI_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
const ARROW_ICON = (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M12 5l7 7-7 7" />
  </svg>
);

const STEP_LABELS: Record<SubStep, string> = { 1: 'The basics', 2: 'Your input', 3: 'Sources & style' };

export interface AiDraftedArticle {
  title: string;
  body: string;
  practiceAreaIds: string[];
  countries: string[];
  state: string;
}

function WizardBackStep({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[13px] font-medium text-ink-3 transition-colors hover:text-ink">
      ← Back
    </button>
  );
}

function WizardNextButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group ml-auto inline-flex items-center gap-[7px] rounded-[9px] bg-ink px-5 py-[11px] text-[13.5px] font-semibold text-bg-card transition-all hover:bg-[color-mix(in_oklab,var(--ink)_85%,black)] hover:gap-2.5"
    >
      {children}
    </button>
  );
}

// Basics -> input -> sources & style -> generate -> inline draft -> refine.
export function AiDraftWizard({
  practiceAreas,
  onDrafted,
}: {
  practiceAreas: PracticeAreaDto[];
  onDrafted: (draft: AiDraftedArticle) => void;
}) {
  const [subStep, setSubStep] = useState<SubStep>(1);
  const [title, setTitle] = useState('');
  const [practiceAreaIds, setPracticeAreaIds] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [state, setState] = useState('');
  const [notes, setNotes] = useState('');
  const [recentDevelopments, setRecentDevelopments] = useState('');
  const [advice, setAdvice] = useState('');
  const [links, setLinks] = useState('');
  const [includeVisual, setIncludeVisual] = useState(true);
  const [tone, setTone] = useState(TONES[0]);
  const [extraInstructions, setExtraInstructions] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stepError, setStepError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string } | null>(null);
  const [refinementNotes, setRefinementNotes] = useState('');
  const [refinementTone, setRefinementTone] = useState('Keep as-is');
  const [refining, setRefining] = useState(false);

  function goToStep2() {
    if (practiceAreaIds.length === 0 || countries.length === 0) {
      setStepError('Select at least one practice area and one country to continue.');
      return;
    }
    setStepError(null);
    setSubStep(2);
  }

  async function generate() {
    setGenError(null);
    setGenerating(true);
    try {
      const result = await generateArticleDraft(
        {
          title: title || undefined,
          practiceAreaIds,
          countries,
          state: state || undefined,
          notes: notes || undefined,
          recentDevelopments: recentDevelopments || undefined,
          advice: advice || undefined,
          sourceLinks: links
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
          includeVisual,
          tone,
          extraInstructions: extraInstructions || undefined,
        },
        files
      );
      setDraft(result);
    } catch (err) {
      setGenError(
        err instanceof ApiError ? err.message : 'Could not generate a draft right now — try again.'
      );
    } finally {
      setGenerating(false);
    }
  }

  async function rephrase() {
    if (!draft || !refinementNotes.trim()) return;
    setGenError(null);
    setRefining(true);
    try {
      const result = await refineArticleDraft({
        title: draft.title,
        body: draft.body,
        refinementNotes,
        tone: refinementTone === 'Keep as-is' ? undefined : refinementTone,
      });
      setDraft(result);
      setRefinementNotes('');
    } catch (err) {
      setGenError(err instanceof ApiError ? err.message : 'Could not apply that refinement — try again.');
    } finally {
      setRefining(false);
    }
  }

  if (draft) {
    return (
      <WriteCard headerIcon={AI_ICON} headerTitle="Expertly AI drafted your article">
        <div className="rounded-xl bg-bg-alt px-5 py-[18px]">
          <div className="mb-3.5 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] px-2.5 py-1 text-[10.5px] font-bold tracking-[0.08em] text-accent">
            AI DRAFT
          </div>
          <h3 className="mb-3.5 text-xl font-semibold tracking-[-0.02em] text-ink">{draft.title}</h3>
          {/* Safe — draft.body is already sanitized by the backend. */}
          <div
            className="prose-article text-sm leading-[1.7] text-ink-2 [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1 [&_strong]:text-ink [&_u]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:pl-3 [&_blockquote]:italic [&_code]:rounded [&_code]:bg-bg-card [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-ink [&_pre]:p-3 [&_pre]:text-bg-card [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_a]:text-accent [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: draft.body }}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-card-lg border border-line bg-bg-card p-6">
          <Textarea
            label="Not quite right? Tell the AI what to change"
            rows={3}
            value={refinementNotes}
            onChange={(e) => setRefinementNotes(e.target.value)}
            placeholder="e.g. make the second section more formal, shorten the intro, add a line on penalties…"
          />
          <div className="grid grid-cols-2 gap-3 max-[480px]:grid-cols-1">
            <Select label="Adjust tone" value={refinementTone} onChange={(e) => setRefinementTone(e.target.value)}>
              {['Keep as-is', 'More formal', 'More casual', 'More concise', 'More detailed'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            <div className="flex items-end">
              <button
                type="button"
                onClick={rephrase}
                disabled={refining || !refinementNotes.trim()}
                className="w-full rounded-[9px] border-[1.5px] border-line-2 bg-bg-card px-[18px] py-2.5 text-[13.5px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {refining ? 'Rephrasing…' : 'Rephrase with these notes'}
              </button>
            </div>
          </div>
        </div>

        {genError && <ErrorBanner message={genError} />}

        <div className="flex justify-end">
          <WriteSubmitButton
            onClick={() => onDrafted({ title: draft.title, body: draft.body, practiceAreaIds, countries, state })}
          >
            Continue to preview {ARROW_ICON}
          </WriteSubmitButton>
        </div>
      </WriteCard>
    );
  }

  return (
    <WriteCard headerIcon={AI_ICON} headerTitle="Expertly AI — a few quick questions">
      <div className="flex items-start">
        {([1, 2, 3] as const).map((n, i) => {
          const dotState = subStep === n ? 'active' : subStep > n ? 'done' : 'upcoming';
          return (
            <Fragment key={n}>
              {i > 0 && <div className={`mt-[13px] h-[1.5px] flex-1 ${subStep > n - 1 ? 'bg-accent' : 'bg-line-2'}`} />}
              <div className="flex w-[92px] flex-none flex-col items-center gap-[7px]">
                <div
                  className={`flex h-[26px] w-[26px] flex-none items-center justify-center rounded-full border-[1.5px] text-xs font-bold ${
                    dotState === 'active'
                      ? 'border-ink bg-ink text-bg-card'
                      : dotState === 'done'
                        ? 'border-accent bg-accent text-bg-card'
                        : 'border-line-2 bg-bg-alt text-ink-4'
                  }`}
                >
                  {n}
                </div>
                <label
                  className={`whitespace-nowrap text-[11px] font-semibold ${
                    dotState === 'upcoming' ? 'text-ink-4' : dotState === 'active' ? 'text-ink' : 'text-ink-2'
                  }`}
                >
                  {STEP_LABELS[n]}
                </label>
              </div>
            </Fragment>
          );
        })}
      </div>

      {generating ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-line-2 border-t-accent" />
          <p className="text-[15px] font-semibold text-ink">Expertly AI is drafting your article…</p>
          <p className="max-w-[340px] text-[13px] leading-[1.55] text-ink-3">This usually takes just a few seconds.</p>
        </div>
      ) : (
        <div className="mt-2 flex animate-[anvIn_0.3s_cubic-bezier(0.22,1,0.36,1)_both] flex-col gap-5">
          {subStep === 1 && (
            <>
              <Input
                label="Title of the article"
                labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. GST implications for SaaS exports"
              />
              <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                <MultiSelect
                  label="Practice area(s)"
                  placeholder="Select practice areas"
                  options={practiceAreas.map((p) => ({ value: p.id, label: p.name }))}
                  selected={practiceAreaIds}
                  onChange={setPracticeAreaIds}
                  allowCustom
                />
                <MultiSelect
                  label="Country"
                  placeholder="Select countries"
                  options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
                  selected={countries}
                  onChange={setCountries}
                />
              </div>
              <Input
                label="State / province"
                labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. California, Maharashtra"
              />
              {stepError && <ErrorBanner message={stepError} />}
              <div className="mt-1 flex items-center justify-between">
                <span />
                <WizardNextButton onClick={goToStep2}>Continue {ARROW_ICON}</WizardNextButton>
              </div>
            </>
          )}

          {subStep === 2 && (
            <>
              <Textarea
                label="Your thoughts / notes"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What's your own take on this? Give the AI your perspective to write from."
              />
              <Textarea
                label="Any recent developments or regulations for this topic?"
                labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                rows={3}
                value={recentDevelopments}
                onChange={(e) => setRecentDevelopments(e.target.value)}
                placeholder="e.g. a new circular, amendment, or ruling the article should reference"
              />
              <Textarea
                label="Your advice / comments for readers"
                rows={3}
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
                placeholder="What should readers actually do with this information?"
              />
              <div className="mt-1 flex items-center justify-between">
                <WizardBackStep onClick={() => setSubStep(1)} />
                <WizardNextButton onClick={() => setSubStep(3)}>Continue {ARROW_ICON}</WizardNextButton>
              </div>
            </>
          )}

          {subStep === 3 && (
            <>
              <div className="rounded-[14px] border border-line bg-bg-alt p-5">
                <span className="text-xs font-medium text-ink-2">
                  Source material <span className="font-normal text-ink-4">(optional, but strongly improves quality)</span>
                </span>
                <p className="-mt-0.5 mb-3 text-[11.5px] text-ink-4">
                  Upload documents or paste links you want the AI to read and pull real detail
                  from — the more grounded the source, the less generic the draft.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-1 rounded-[14px] border-2 border-dashed border-line-2 px-4 py-[26px] text-center transition-colors hover:border-accent hover:bg-[color-mix(in_oklab,var(--accent)_4%,transparent)]"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="mb-1.5 text-ink-4">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span className="text-sm font-medium text-ink-2">
                    Drag &amp; drop documents, or <span className="text-accent underline">browse</span>
                  </span>
                  <span className="mt-1 text-[11.5px] text-ink-4">Circulars, notes, judgments, decks — PDF, DOCX, TXT</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".doc,.docx,.pdf,.txt"
                  multiple
                  hidden
                  onChange={(e) => setFiles((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                />
                {files.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {files.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-lg border border-line-2 bg-bg-card py-[5px] pl-2 pr-2.5 text-xs font-medium text-ink-2">
                        {f.name}
                        <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="text-ink-4 hover:text-ink">
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3.5">
                  <Textarea
                    label="Links for the AI to research"
                    labelRight={<span className="text-xs font-normal text-ink-3">one per line</span>}
                    rows={3}
                    value={links}
                    onChange={(e) => setLinks(e.target.value)}
                    placeholder={'https://…\nhttps://…'}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-ink-2">
                <input type="checkbox" checked={includeVisual} onChange={(e) => setIncludeVisual(e.target.checked)} className="accent-accent" />
                Let Expertly AI include a table if it&apos;s relevant to the topic
              </label>

              <div className="grid grid-cols-2 gap-4 max-[480px]:grid-cols-1">
                <Select label="Tone" value={tone} onChange={(e) => setTone(e.target.value)}>
                  {TONES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
                <Input
                  label="Anything else?"
                  labelRight={<span className="text-xs font-normal text-ink-3">optional</span>}
                  value={extraInstructions}
                  onChange={(e) => setExtraInstructions(e.target.value)}
                  placeholder="e.g. keep it brief, ~600 words, avoid jargon…"
                />
              </div>

              {genError && <ErrorBanner message={genError} />}

              <div className="mt-1 flex items-center justify-between">
                <WizardBackStep onClick={() => setSubStep(2)} />
                <WriteSubmitButton onClick={generate}>Generate with Expertly AI {ARROW_ICON}</WriteSubmitButton>
              </div>
            </>
          )}
        </div>
      )}
    </WriteCard>
  );
}
