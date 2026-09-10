import { Button } from '@/components/ui';

// Not personalized with the member's name — there's no public by-id endpoint to source one from.
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
