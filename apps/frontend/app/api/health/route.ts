import { NextResponse } from 'next/server';

// Deploy healthcheck target — deliberately independent of app/page.tsx and
// every other route, so Coolify's healthcheck (currently pointed at `/`)
// doesn't report a false "unhealthy"/auto-rollback whenever the homepage is
// mid-rebuild or, as happened during this repo's history rewrite, doesn't
// exist yet at a given commit. See docs/deployment.md.
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
