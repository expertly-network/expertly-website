import { Button } from '@/components/ui';

// Generic copy, not personalized with the member's name — a deliberate
// deviation from the prototype (see design spec §3): the real
// GET /v1/members/:id 401s for guests entirely, so there's no way to source
// a name to personalize this with without a public by-id endpoint that
// doesn't exist in the contract.
export function ProfileAuthWall() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
      <h1 className="text-heading text-ink">Sign in to view this profile</h1>
      <p className="text-sm text-ink-3">
        Sign in to view the full profile, including experience, services, and contact details.
      </p>
      <div className="mt-2 flex gap-3">
        <Button href="/login">Sign In</Button>
        <Button href="/apply" variant="secondary">
          Apply for membership
        </Button>
      </div>
    </div>
  );
}
