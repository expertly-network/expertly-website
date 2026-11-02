import { getSupabaseUrl } from '@/lib/env';

// next/image may only proxy hosts listed in next.config.js images.remotePatterns (Supabase Storage
// public objects, the testimonial placeholders) — any other host throws at render time. Image URLs
// here come from data, not code: member photos can be an OAuth avatar (LinkedIn, Google) or an
// absolute seed URL, and article covers accept any https host. So everything outside that list
// loads directly. Unsplash is deliberately outside it too: its API guidelines require hotlinking
// the images.unsplash.com URL the API returned (views are tracked per hotlink), and its own CDN
// already serves them resized and compressed.

// The project URL is runtime config (lib/env.ts), so it's resolved per call, not at module load.
function supabasePublicPrefix(): string | null {
  try {
    return `${new URL(getSupabaseUrl()).origin}/storage/v1/object/public/`;
  } catch {
    return null;
  }
}

function isOptimizable(src: string): boolean {
  try {
    const url = new URL(src);
    const supabasePrefix = supabasePublicPrefix();
    if (supabasePrefix && url.href.startsWith(supabasePrefix)) return true;
    return url.hostname === 'randomuser.me' && url.pathname.startsWith('/api/portraits/');
  } catch {
    // A relative path (e.g. /images/...) is served by this app and always optimizable.
    return src.startsWith('/') && !src.startsWith('//');
  }
}

/** Pass as next/image's `unoptimized` prop for any image whose URL comes from data. */
export function mustHotlink(src: string): boolean {
  return !isOptimizable(src);
}
