// next/image may only proxy hosts listed in next.config.js images.remotePatterns (Supabase Storage
// public objects, the testimonial placeholders) — any other host throws at render time. Image URLs
// here come from data, not code: member photos can be an OAuth avatar (LinkedIn, Google) or an
// absolute seed URL, and article covers accept any https host. So everything outside that list
// loads directly. Unsplash is deliberately outside it too: its API guidelines require hotlinking
// the images.unsplash.com URL the API returned (views are tracked per hotlink), and its own CDN
// already serves them resized and compressed.
const SUPABASE_PUBLIC_PREFIX = (() => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return `${url.origin}/storage/v1/object/public/`;
  } catch {
    return null;
  }
})();

function isOptimizable(src: string): boolean {
  try {
    const url = new URL(src);
    if (SUPABASE_PUBLIC_PREFIX && url.href.startsWith(SUPABASE_PUBLIC_PREFIX)) return true;
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
