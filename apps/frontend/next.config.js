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

// NEXT_PUBLIC_* values are inlined into the bundles at build time, so a build without them ships a
// broken app. Fail `next build` instead (lib/env.ts repeats the check at runtime). CI builds with
// placeholder values, which pass — only presence and URL shape are checked here.
function validateBuildEnv() {
  const problems = [];
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    if (!process.env[name]) problems.push(`${name} is not set`);
  }
  for (const name of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_SITE_URL']) {
    const value = process.env[name];
    if (!value) continue;
    // NEXT_PUBLIC_SITE_URL may list several origins, comma-separated (lib/env.ts).
    const entries = name === 'NEXT_PUBLIC_SITE_URL' ? value.split(',').map((v) => v.trim()) : [value];
    for (const entry of entries) {
      try {
        new URL(entry);
      } catch {
        problems.push(`${name} is not a valid URL ("${entry}")`);
      }
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
function remotePatterns() {
  const patterns = [{ protocol: 'https', hostname: 'randomuser.me', pathname: '/api/portraits/**' }];
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl);
      patterns.push({
        protocol: url.protocol.replace(':', ''),
        hostname: url.hostname,
        ...(url.port ? { port: url.port } : {}),
        pathname: '/storage/v1/object/public/**',
      });
    } catch {
      // Reported by validateBuildEnv().
    }
  }
  return patterns;
}

/** @type {(phase: string) => import('next').NextConfig} */
module.exports = (phase) => {
  // `next lint` loads this config under the same phase; only a real `next build` needs the env.
  const isLint = process.argv.some((arg) => arg === 'lint' || arg.endsWith('next-lint.js'));
  if (phase === PHASE_PRODUCTION_BUILD && !isLint) validateBuildEnv();

  return {
    output: 'standalone',
    poweredByHeader: false,
    images: { remotePatterns: remotePatterns() },
    async headers() {
      return [{ source: '/:path*', headers: securityHeaders }];
    },
  };
};
