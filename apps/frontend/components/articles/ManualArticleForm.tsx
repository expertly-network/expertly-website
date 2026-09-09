'use client';

import { useEffect, useRef, useState } from 'react';
import { Input, MultiSelect } from '@/components/ui';
import { WriteCard } from '@/components/articles/WriteCard';
import { WriteSubmitButton } from '@/components/articles/WriteSubmitButton';
import { RichTextEditor } from '@/components/articles/RichTextEditor';
import { getCoverImageSuggestions, suggestTopics } from '@/lib/api/articles';
import type { PracticeAreaDto } from '@shared/practice-area';
import { ALL_COUNTRIES } from '@/lib/members/countries';

const DOCUMENT_ICON = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14,2 14,8 20,8" />
  </svg>
);

const MIN_WORDS = 800;
const MAX_WORDS = 2000;

export interface ManualArticleFormState {
  title: string;
  practiceAreaIds: string[];
  countries: string[];
  state: string;
  body: string;
  coverImageUrl: string;
}

const EMPTY: ManualArticleFormState = {
  title: '',
  practiceAreaIds: [],
  countries: [],
  state: '',
  body: '',
  // Fetched async on mount (see the cover-image effect below) — a live Unsplash search, not a
  // static default, so this starts empty rather than pre-picked.
  coverImageUrl: '',
};

export { EMPTY as EMPTY_MANUAL_ARTICLE_FORM };

// `body` is HTML now that the content field is a rich text editor, not plain text — strip tags
// before counting so markup itself doesn't inflate the count. DOM-based (this only ever runs
// client-side) rather than a regex strip, for the same reason the backend uses a real HTML
// parser (sanitize-html) rather than a regex — tags can nest/contain attributes arbitrarily.
function wordCount(html: string): number {
  if (typeof document === 'undefined') return 0;
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = (div.textContent ?? '').trim();
  return text ? text.split(/\s+/).length : 0;
}

// Cosmetic-only, never persisted (see docs/database-erd.md's note that the prototype's tags were
// always UI suggestions, never real data) — derived from selected practice areas + a handful of
// capitalized words from the title, shown only to make the write experience feel considered.
function suggestTags(title: string, practiceAreaNames: string[]): string[] {
  const titleWords = title
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ''))
    .filter((w) => w.length > 4)
    .slice(0, 3);
  return [...new Set([...practiceAreaNames, ...titleWords])].slice(0, 5);
}

// Matches design/static_html/articles.html's `#anv-write-upload` step — title, practice areas +
// countries (both genuinely multi-select), optional state, content textarea with word count,
// auto-selected cover image + shuffle, cosmetic suggested tags, then "Preview article". Topic
// suggestions and the cover image are both live, backend-proxied calls (POST /articles/
// suggest-topics — a real AI call; GET /articles/cover-images — a live Unsplash search) rather
// than local canned data.
export function ManualArticleForm({
  practiceAreas,
  value,
  onChange,
  onPreview,
  onSaveDraft,
  savingDraft,
}: {
  practiceAreas: PracticeAreaDto[];
  value: ManualArticleFormState;
  onChange: (patch: Partial<ManualArticleFormState>) => void;
  onPreview: () => void;
  // Omitted when editing an already-live article — there's no "draft" to save back to, only a
  // direct content edit (see WriteArticleFlow's isLiveEdit).
  onSaveDraft?: () => void;
  savingDraft: boolean;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [topics, setTopics] = useState<string[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [coverImageOptions, setCoverImageOptions] = useState<string[]>([]);
  const [coverImageIndex, setCoverImageIndex] = useState(0);
  const [coverImageLoading, setCoverImageLoading] = useState(true);
  const words = wordCount(value.body);

  const selectedPracticeAreaNames = practiceAreas
    .filter((p) => value.practiceAreaIds.includes(p.id))
    .map((p) => p.name);

  async function loadTopics(practiceAreaIds: string[]) {
    setTopicsLoading(true);
    try {
      const { topics: result } = await suggestTopics({ practiceAreaIds });
      setTopics(result);
    } catch {
      setTopics([]);
    } finally {
      setTopicsLoading(false);
    }
  }

  async function loadCoverImages(query: string) {
    setCoverImageLoading(true);
    try {
      const { images } = await getCoverImageSuggestions(query || undefined);
      setCoverImageOptions(images);
      setCoverImageIndex(0);
      if (images.length > 0) onChange({ coverImageUrl: images[0] });
    } catch {
      setCoverImageOptions([]);
    } finally {
      setCoverImageLoading(false);
    }
  }

  // Fetch once on mount, before any practice area is necessarily selected — matches the
  // prototype showing real suggestions/an image from the very first render.
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    loadTopics([]);
    loadCoverImages('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function shuffle() {
    if (coverImageOptions.length === 0) return;
    const nextIndex = (coverImageIndex + 1) % coverImageOptions.length;
    setCoverImageIndex(nextIndex);
    onChange({ coverImageUrl: coverImageOptions[nextIndex] });
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!value.title.trim()) e.title = 'Title is required.';
    if (value.practiceAreaIds.length === 0) e.practiceAreaIds = 'Select at least one practice area.';
    if (value.countries.length === 0) e.countries = 'Select at least one country.';
    if (words < MIN_WORDS || words > MAX_WORDS) {
      e.body = `Article content must be between ${MIN_WORDS} and ${MAX_WORDS} words (currently ${words}).`;
    }
    return e;
  }

  function handlePreview() {
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onPreview();
  }

  return (
    <WriteCard headerIcon={DOCUMENT_ICON} headerTitle="Write your article">
      <div>
        <Input
          label="Title"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          error={errors.title}
          placeholder="e.g. Navigating Stamp Duty on Cross-Border Mergers"
          required
        />
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-3">
            {topicsLoading ? 'Generating ideas…' : 'Stuck? Try a topic:'}
          </span>
          {!topicsLoading &&
            topics.map((topic, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange({ title: topic })}
                className="rounded-full border border-line-2 bg-bg-alt px-[13px] py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-accent hover:text-accent"
              >
                {topic}
              </button>
            ))}
          {!topicsLoading && (
            <button
              type="button"
              title="Show other ideas"
              onClick={() => loadTopics(value.practiceAreaIds)}
              className="rounded-full border border-transparent px-[13px] py-1.5 text-[12.5px] text-ink-3 transition-colors hover:border-line-2 hover:text-accent"
            >
              ↻ More ideas
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <MultiSelect
          label="Practice area(s)"
          placeholder="Select practice areas"
          options={practiceAreas.map((p) => ({ value: p.id, label: p.name }))}
          selected={value.practiceAreaIds}
          onChange={(ids) => {
            onChange({ practiceAreaIds: ids });
            const names = practiceAreas.filter((p) => ids.includes(p.id)).map((p) => p.name);
            loadCoverImages(names.join(' '));
          }}
          allowCustom
          error={errors.practiceAreaIds}
        />
        <MultiSelect
          label="Country"
          placeholder="Select countries"
          options={ALL_COUNTRIES.map((c) => ({ value: c, label: c }))}
          selected={value.countries}
          onChange={(countries) => onChange({ countries })}
          error={errors.countries}
        />
      </div>

      <Input
        label="State / province"
        labelRight={<span className="text-xs font-normal text-ink-3">optional — only if state-specific</span>}
        value={value.state}
        onChange={(e) => onChange({ state: e.target.value })}
        placeholder="e.g. California, Maharashtra"
      />

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-ink-2">
            Article content <span className="text-error">*</span>
          </span>
          <span className="text-xs text-ink-3">{words} words</span>
        </div>
        <RichTextEditor
          value={value.body}
          onChange={(html) => onChange({ body: html })}
          placeholder="Write or paste your article here…"
        />
        {errors.body ? (
          <span className="mt-1.5 block text-xs text-error">{errors.body}</span>
        ) : (
          <span className="mt-1.5 block text-xs text-ink-3">
            Minimum {MIN_WORDS} words, maximum {MAX_WORDS} words.
          </span>
        )}
      </div>

      <div className="flex items-center gap-3.5 rounded-[14px] border border-line bg-bg-alt p-3.5">
        {coverImageLoading ? (
          <div className="h-16 w-[84px] flex-none animate-pulse rounded-[9px] bg-line-2" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value.coverImageUrl} alt="" className="h-16 w-[84px] flex-none rounded-[9px] bg-line-2 object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-ink">Auto-selected cover image</div>
          <p className="mt-0.5 text-xs text-ink-4">
            Picked to match your practice area — swap it any time before submitting.
          </p>
          <button
            type="button"
            onClick={shuffle}
            disabled={coverImageLoading || coverImageOptions.length < 2}
            className="mt-2 rounded-[9px] border-[1.5px] border-line-2 bg-bg-card px-3 py-1.5 text-xs font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Try another image
          </button>
        </div>
      </div>

      {selectedPracticeAreaNames.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">Suggested tags</span>
          <div className="flex flex-wrap gap-2">
            {suggestTags(value.title, selectedPracticeAreaNames).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[color-mix(in_oklab,var(--accent)_30%,transparent)] bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] px-3 py-1.5 text-[11.5px] font-semibold tracking-[0.02em] text-accent"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className={`flex items-center gap-3 ${onSaveDraft ? 'justify-between' : 'justify-end'}`}>
        {onSaveDraft && (
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={
              savingDraft ||
              !value.title.trim() ||
              value.practiceAreaIds.length === 0 ||
              value.countries.length === 0
            }
            className="rounded-[9px] border-[1.5px] border-line-2 bg-bg-card px-[18px] py-2.5 text-[13.5px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingDraft ? 'Saving…' : 'Save draft'}
          </button>
        )}
        <div className="text-right">
          <WriteSubmitButton onClick={handlePreview}>
            Preview article
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </WriteSubmitButton>
          <p className="mt-1.5 text-xs text-ink-3">
            See exactly how it&apos;ll look on Expertly before you submit it.
          </p>
        </div>
      </div>
    </WriteCard>
  );
}
