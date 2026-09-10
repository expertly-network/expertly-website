import { WriteSubmitButton } from '@/components/articles/WriteSubmitButton';

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
});

const CLOCK_ICON = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-ink-4">
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z" />
  </svg>
);

// Mirrors the real article detail page's markup, so this preview is an honest "as it will
// look" claim.
export function ArticleLivePreview({
  title,
  body,
  coverImageUrl,
  practiceAreaName,
  countries,
  authorName,
  onBack,
  onConfirm,
  confirmLabel,
  confirming,
}: {
  title: string;
  body: string;
  coverImageUrl: string;
  practiceAreaName?: string;
  countries: string[];
  authorName: string;
  onBack: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirming: boolean;
}) {
  return (
    <div>
      <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-3">
        <span className="flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-accent">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15 15 0 010 20 15 15 0 010-20z" />
          </svg>
          This is exactly how your article will appear once it&apos;s live
        </span>
      </div>

      <div className="animate-[anvIn_0.4s_cubic-bezier(0.22,1,0.36,1)_both] overflow-hidden rounded-[22px] border border-line bg-bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02),0_32px_64px_-32px_rgba(0,0,0,0.2)]">
        <div className="relative h-[170px] overflow-hidden bg-ink min-[760px]:h-[220px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverImageUrl} alt="" className="h-full w-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(11,11,12,0.88)_0%,rgba(11,11,12,0.25)_55%,transparent_100%)]" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-3 px-7 py-5">
            {practiceAreaName && (
              <span className="rounded-full border border-white/[0.18] bg-white/10 px-3 py-1 text-[10.5px] font-bold tracking-[0.1em] text-accent">
                {practiceAreaName.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        <div className="p-[24px_22px_28px] min-[760px]:p-[32px_40px_40px]">
          <h1 className="text-[clamp(22px,2.6vw,32px)] font-medium leading-[1.15] tracking-[-0.025em] text-ink">
            {title || 'Untitled article'}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-[18px] border-b border-line pb-[18px]">
            <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.05em] text-ink-3">
              {CLOCK_ICON}
              {DATE_FORMAT.format(new Date()).toUpperCase()}
            </span>
            <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.05em] text-ink-3">
              {authorName}
            </span>
            {countries.length > 0 && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-[0.05em] text-ink-3">
                {countries.join(', ')}
              </span>
            )}
          </div>

          <div
            className="prose-article mt-8 text-[16px] leading-[1.75] tracking-[-0.003em] text-ink-2 [&_blockquote]:my-6 [&_blockquote]:rounded-r-[10px] [&_blockquote]:border-l-[3px] [&_blockquote]:border-accent [&_blockquote]:bg-bg-alt [&_blockquote]:px-[22px] [&_blockquote]:py-[18px] [&_blockquote]:font-serif [&_blockquote]:text-[17px] [&_blockquote]:italic [&_blockquote]:leading-[1.5] [&_blockquote]:text-ink [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-[clamp(17px,1.8vw,22px)] [&_h2]:font-medium [&_h2]:text-ink [&_li]:relative [&_li]:pl-[15px] [&_ol]:my-0 [&_ol]:mb-5 [&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-2 [&_ol]:pl-5 [&_p]:mb-5 [&_p:last-child]:mb-0 [&_strong]:text-ink [&_ul]:my-0 [&_ul]:mb-5 [&_ul]:flex [&_ul]:list-none [&_ul]:flex-col [&_ul]:gap-2 [&_ul_li]:before:absolute [&_ul_li]:before:left-0 [&_ul_li]:before:top-[10px] [&_ul_li]:before:h-[5px] [&_ul_li]:before:w-[5px] [&_ul_li]:before:flex-none [&_ul_li]:before:rounded-full [&_ul_li]:before:bg-accent [&_a]:text-accent [&_a]:underline [&_code]:rounded [&_code]:bg-bg-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[14px] [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-ink [&_pre]:p-4 [&_pre]:text-bg-card [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit"
            dangerouslySetInnerHTML={{ __html: body }}
          />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-bg-card px-6 py-[18px]">
        <span className="text-sm font-semibold text-ink">Happy with how it looks?</span>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onBack}
            className="rounded-[9px] border-[1.5px] border-line-2 bg-bg-card px-[18px] py-2.5 text-[13.5px] font-semibold text-ink-2 transition-colors hover:border-ink-3 hover:text-ink"
          >
            ← Back to form
          </button>
          <WriteSubmitButton onClick={onConfirm} disabled={confirming}>
            {confirming ? 'Submitting…' : confirmLabel}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </WriteSubmitButton>
        </div>
      </div>
    </div>
  );
}
