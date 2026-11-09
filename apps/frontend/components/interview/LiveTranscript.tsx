'use client';

import { useEffect, useRef, useState } from 'react';

export interface TranscriptLine {
  id: string;
  role: 'agent' | 'user';
  text: string;
  /** False while the interviewer's reply is still streaming in. */
  final: boolean;
}

// Auto-scrolls while the reader is at the bottom; pauses when they scroll up to re-read, with a
// "Jump to latest" button to resume. Display-only: the kept record is the signed webhook transcript.
export function LiveTranscript({ turns }: { turns: TranscriptLine[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [stick, setStick] = useState(true);

  useEffect(() => {
    if (stick && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [turns, stick]);

  return (
    <div className="relative h-full">
      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          setStick(el.scrollTop + el.clientHeight >= el.scrollHeight - 40);
        }}
        className="h-full overflow-y-auto px-4 py-5 sm:px-6"
        aria-live="polite"
        aria-label="Live transcript"
      >
        {turns.length === 0 ? (
          <p className="text-sm text-ink-3">The conversation will appear here as you talk.</p>
        ) : (
          <ol className="space-y-4">
            {turns.map((t) => (
              <li key={t.id} className={t.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-base leading-relaxed sm:text-sm ${
                    t.role === 'user' ? 'bg-ink text-bg' : 'bg-bg-alt text-ink'
                  } ${t.final ? '' : 'opacity-70'}`}
                >
                  <span className="sr-only">{t.role === 'user' ? 'You: ' : 'Interviewer: '}</span>
                  {t.text}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      {!stick && (
        <button
          type="button"
          onClick={() => setStick(true)}
          className="absolute bottom-3 left-1/2 min-h-[44px] -translate-x-1/2 rounded-full border border-line-2 bg-bg-card px-4 text-sm text-ink shadow-panel"
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}
