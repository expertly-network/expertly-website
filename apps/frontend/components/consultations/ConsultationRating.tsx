'use client';

import { useState } from 'react';
import { rateConsultation } from '@/lib/api/consultations';
import { ApiError } from '@/lib/api/client';

const STAR_PATH = 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z';

// Replaces the message composer on the requester's side once the member has decided — the
// requester rates the conversation 1-5 instead of continuing to send messages.
export function ConsultationRating({
  requestId,
  initialRating,
}: {
  requestId: string;
  initialRating: number | null | undefined;
}) {
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [hover, setHover] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRate(value: number) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await rateConsultation(requestId, value);
      setRating(value);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save your rating.');
    } finally {
      setSaving(false);
    }
  }

  const displayed = hover ?? rating ?? 0;

  return (
    <div className="mt-4 rounded-lg border border-line bg-bg-alt px-3.5 py-3">
      <p className="text-caption font-medium text-ink-2">{rating ? 'Rated conversation' : 'Rate this conversation'}</p>
      <div className="mt-1.5 flex items-center gap-1" role="radiogroup" aria-label="Rate this conversation out of 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} out of 5`}
            disabled={saving}
            onClick={() => handleRate(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(null)}
            className={`transition-colors disabled:cursor-not-allowed ${
              displayed >= n ? 'text-amber-400' : 'text-ink-4 hover:text-amber-400'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={displayed >= n ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
              <path d={STAR_PATH} strokeLinejoin="round" />
            </svg>
          </button>
        ))}
        {rating && <span className="ml-1 text-caption text-ink-3">{rating}/5</span>}
      </div>
      {error && <p className="mt-1.5 text-xs text-error">{error}</p>}
    </div>
  );
}
