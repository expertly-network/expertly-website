const { PHASE_PRODUCTION_BUILD } = require('next/constants');

// Static response headers for every route. The Content-Security-Policy is NOT here: it carries a
// per-request script nonce, so middleware.ts builds it (and sets frame-ancestors 'none' etc.).
// HSTS deliberately has no `preload` — that needs a hstspreload.org submission and is hard to undo.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The image cropper and file pickers need none of these device APIs.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

// Deployment config (API_URL, SUPABASE_URL, SUPABASE_ANON_KEY) is runtime-only (lib/env.ts) — the
// build carries none of it. The one NEXT_PUBLIC_* value that may be present at build time is the site
// origin; if it is, fail `next build` on a malformed one rather than ship it.
function validateBuildEnv() {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  if (!value) return;
  // NEXT_PUBLIC_SITE_URL may list several origins, comma-separated (lib/env.ts).
  const problems = [];
  for (const entry of value.split(',').map((v) => v.trim())) {
    try {
      new URL(entry);
    } catch {
      problems.push(`NEXT_PUBLIC_SITE_URL is not a valid URL ("${entry}")`);
    }
  }
  if (problems.length) {
    throw new Error(`Invalid build environment (see apps/frontend/.env.example):\n- ${problems.join('\n- ')}`);
  }
}

// next/image may optimize images from these hosts only: Supabase Storage public objects (avatars,
// logos, uploaded covers, resource assets) and randomuser.me (homepage testimonial placeholder
// photos). Unsplash images are rendered `unoptimized` (hotlinked — lib/images.ts),
// and admin-entered arbitrary resource image URLs go through ResourceImage, also unoptimized.
// The Supabase project is runtime config, so the build can't name its host: any *.supabase.co
// project's public storage path is allowed here, and lib/images.ts only routes this deployment's
// own project through the optimizer.
function remotePatterns() {
  return [
    { protocol: 'https', hostname: 'randomuser.me', pathname: '/api/portraits/**' },
    { protocol: 'https', hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' },
  ];
}

/** @type {(phase: string) => import('next').NextConfig} */
module.exports = (phase) => {
  if (phase === PHASE_PRODUCTION_BUILD) validateBuildEnv();

  return {
    output: 'standalone',
    poweredByHeader: false,
    images: { remotePatterns: remotePatterns() },
    async headers() {
      return [{ source: '/:path*', headers: securityHeaders }];
    },
  };
};
