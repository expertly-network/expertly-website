// Under a pending entry, for the owner only: an invitation to add proof so the GrowXQ team can
// verify it faster. Proof is optional — the entry is live either way — so this is a nudge, not a
// request. Once proof is attached it says so instead.
export function AddProofPrompt({
  isOwnProfile,
  verified,
  hasProof,
  onAddProof,
}: {
  isOwnProfile: boolean;
  verified: boolean;
  hasProof: boolean;
  onAddProof: () => void;
}) {
  if (!isOwnProfile || verified) return null;
  if (hasProof) {
    return <p className="mt-2 text-profile-meta text-ink-3">Proof added — waiting for the GrowXQ team to verify.</p>;
  }
  return (
    <p className="mt-2 text-profile-meta text-ink-3">
      Pending verification.{' '}
      <button type="button" onClick={onAddProof} className="font-semibold text-accent hover:underline">
        Add proof to get it verified faster
      </button>
    </p>
  );
}
