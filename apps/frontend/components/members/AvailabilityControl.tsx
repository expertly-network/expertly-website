'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/components/ui';
import { ApiError } from '@/lib/api/client';
import { updateMember } from '@/lib/api/members';
import type { MemberDto } from '@shared/member';

const NOTE_MAX = 200;

// Owner-only replacement for the read-only availability line in ProfileSidebar: a switch that
// applies immediately (no admin review) plus an optional short note, e.g. "Back from 4 Nov".
export function AvailabilityControl({ member }: { member: MemberDto }) {
  const router = useRouter();
  const [isAvailable, setIsAvailable] = useState(member.isAvailable);
  const [note, setNote] = useState(member.availabilityNotes ?? '');
  const [savedNote, setSavedNote] = useState(member.availabilityNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: { isAvailable: boolean; availabilityNotes?: string | null }) {
    setSaving(true);
    setError(null);
    try {
      const saved = await updateMember(member.id, next);
      setIsAvailable(saved.isAvailable);
      setSavedNote(saved.availabilityNotes ?? '');
      setNote(saved.availabilityNotes ?? '');
      router.refresh();
    } catch (err) {
      setIsAvailable(member.isAvailable);
      setError(err instanceof ApiError ? err.message : 'Could not update your availability — please try again.');
    } finally {
      setSaving(false);
    }
  }

  function toggle() {
    const next = !isAvailable;
    setIsAvailable(next); // optimistic; reverted on failure
    void save({ isAvailable: next });
  }

  const noteDirty = note.trim() !== savedNote.trim();

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`flex items-center gap-1.5 text-caption font-medium ${isAvailable ? 'text-[#16a34a]' : 'text-ink-3'}`}
        >
          <span className={`h-2 w-2 flex-none rounded-full ${isAvailable ? 'bg-[#16a34a]' : 'bg-ink-4'}`} />
          {isAvailable ? 'Available for consultations' : 'Currently unavailable'}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isAvailable}
          aria-label="Available for consultations"
          disabled={saving}
          onClick={toggle}
          className={`relative h-6 w-11 flex-none rounded-full transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[color-mix(in_oklab,var(--accent)_25%,transparent)] disabled:opacity-60 ${
            isAvailable ? 'bg-accent' : 'bg-line-2'
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-bg-card shadow transition-transform ${
              isAvailable ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (noteDirty) void save({ isAvailable, availabilityNotes: note.trim() || null });
        }}
      >
        <div className="min-w-0 flex-1">
          <Input
            label="Status note (optional)"
            name="availabilityNotes"
            placeholder="e.g. Back from 4 Nov"
            maxLength={NOTE_MAX}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {noteDirty && (
          <Button type="submit" variant="secondary" disabled={saving} className="mb-px">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        )}
      </form>
      <p className="text-[11.5px] leading-relaxed text-ink-4">
        Visible to everyone on your profile. Changes apply immediately.
      </p>
      {error && (
        <p role="alert" className="text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
