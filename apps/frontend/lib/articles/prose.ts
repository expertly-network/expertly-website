// Typography for sanitized article HTML (rendered with dangerouslySetInnerHTML or edited in Tiptap),
// styled with Tailwind arbitrary child variants since there's no typography plugin. One place for
// every renderer, so the published page and its previews can't drift apart. Layout (margins,
// padding, min-height) stays at the call site. Tailwind scans this file (tailwind.config.ts
// `content`), so these must stay complete literal class names — never build them dynamically.

/** Shared by every article renderer: links, inline/blocked code, ordered lists, blockquote accent. */
const PROSE_BASE =
  'prose-article [&_blockquote]:border-accent [&_blockquote]:italic [&_ol]:list-decimal [&_ol]:pl-5 [&_p:last-child]:mb-0 [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_pre]:overflow-x-auto [&_pre]:bg-ink [&_pre]:text-bg-card [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit';

/** The published article page and the write flow's full-page preview (ArticleLivePreview). */
export const ARTICLE_PROSE = `${PROSE_BASE} text-[16px] leading-[1.75] tracking-[-0.003em] text-ink-2 [&_blockquote]:my-6 [&_blockquote]:rounded-r-[10px] [&_blockquote]:border-l-[3px] [&_blockquote]:bg-bg-alt [&_blockquote]:px-[22px] [&_blockquote]:py-[18px] [&_blockquote]:font-serif [&_blockquote]:text-[17px] [&_blockquote]:leading-[1.5] [&_blockquote]:text-ink [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-[clamp(17px,1.8vw,22px)] [&_h2]:font-medium [&_h2]:leading-[1.2] [&_h2]:tracking-[-0.02em] [&_h2]:text-ink [&_h3]:mb-2.5 [&_h3]:mt-6 [&_h3]:text-[16px] [&_h3]:font-medium [&_h3]:tracking-[-0.01em] [&_h3]:text-ink [&_li]:relative [&_li]:pl-[15px] [&_ol]:my-0 [&_ol]:mb-5 [&_ol]:flex [&_ol]:flex-col [&_ol]:gap-2 [&_p]:mb-5 [&_strong]:text-ink [&_ul]:my-0 [&_ul]:mb-5 [&_ul]:flex [&_ul]:list-none [&_ul]:flex-col [&_ul]:gap-2 [&_ul_li]:before:absolute [&_ul_li]:before:left-0 [&_ul_li]:before:top-[10px] [&_ul_li]:before:h-[5px] [&_ul_li]:before:w-[5px] [&_ul_li]:before:flex-none [&_ul_li]:before:rounded-full [&_ul_li]:before:bg-accent [&_code]:bg-bg-alt [&_code]:text-[14px] [&_pre]:my-5 [&_pre]:rounded-xl [&_pre]:p-4`;

/** Compact 14px variant for in-form previews and the editor: bullet lists, thin blockquote rule. */
const COMPACT_PROSE = `${PROSE_BASE} text-sm [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_li]:mb-1 [&_u]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code]:text-[13px] [&_pre]:my-3 [&_pre]:rounded-lg [&_pre]:p-3`;

/** The AI draft wizard's inline "AI draft" preview (AiDraftWizard). */
export const AI_DRAFT_PROSE = `${COMPACT_PROSE} leading-[1.7] text-ink-2 [&_p]:mb-4 [&_strong]:text-ink [&_code]:bg-bg-card`;

/** The admin AI-generation log's draft body (AiGenerationDetail): the draft preview plus headings and tables. */
export const AI_GENERATION_PROSE = `${COMPACT_PROSE} leading-[1.7] text-ink-2 [&_p]:mb-4 [&_strong]:text-ink [&_code]:bg-bg-alt [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:font-semibold [&_h3]:text-ink [&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_th]:border [&_th]:border-line [&_th]:bg-bg-alt [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium [&_th]:text-ink [&_td]:border [&_td]:border-line [&_td]:px-3 [&_td]:py-2`;

/** The Tiptap rich-text editor's content area (RichTextEditor), including its empty-state placeholder. */
export const EDITOR_PROSE = `${COMPACT_PROSE} leading-relaxed text-ink [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-[17px] [&_h2]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-[15px] [&_h3]:font-semibold [&_p]:mb-3 [&_blockquote]:text-ink-2 [&_code]:bg-bg-alt [&_.is-editor-empty:first-child::before]:pointer-events-none [&_.is-editor-empty:first-child::before]:float-left [&_.is-editor-empty:first-child::before]:h-0 [&_.is-editor-empty:first-child::before]:text-ink-4 [&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]`;
