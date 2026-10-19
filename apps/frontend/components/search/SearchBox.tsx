'use client';

import { useState, type ReactNode, type Ref } from 'react';
import { SearchModal } from '@/components/home/SearchModal';
import type { SearchScope } from '@shared/search';

const MAX_QUERY_LENGTH = 500;

// An inline AI-search input: the user types in place, and only Enter / the button opens the
// SearchModal, which runs the typed question straight away (POST /v1/search). Clicking the box
// never opens the modal. Used by the home page panel and the articles / events hero bars.
export function SearchBox({
  scope = 'all',
  placeholder,
  buttonLabel = 'Find →',
  leading,
  inputRef,
  className = '',
}: {
  scope?: SearchScope;
  placeholder: string;
  buttonLabel?: string;
  /** Icon / dot shown before the input. */
  leading?: ReactNode;
  /** Lets a parent focus the input (e.g. a "Try Expertly" button). */
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
}) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState('');
  const canSubmit = text.trim().length > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitted(text.trim());
    setOpen(true);
  }

  return (
    <>
      <form onSubmit={submit} role="search" className={`flex w-full items-center gap-3 ${className}`}>
        {leading}
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          type="search"
          enterKeyHint="search"
          maxLength={MAX_QUERY_LENGTH}
          placeholder={placeholder}
          aria-label="Search Expertly"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="flex-none rounded-input bg-ink px-4 py-2 text-sm font-medium text-bg transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {buttonLabel}
        </button>
      </form>

      <SearchModal open={open} onClose={() => setOpen(false)} initialQuery={submitted} scope={scope} />
    </>
  );
}
