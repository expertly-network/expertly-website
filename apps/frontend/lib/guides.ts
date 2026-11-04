import { getSupabaseUrl } from '@/lib/env';

// How-to videos live in the public `guide-videos` Storage bucket (supabase/migrations/0004_tables.sql),
// uploaded by hand. Resolved against the runtime Supabase URL so each deployment serves its own copy.
export const GUIDE_BUCKET = 'guide-videos';
// Bump when re-uploading a video under the same name, so browsers/CDN don't keep the old one.
const GUIDE_VERSION = 1;

export type GuideDevice = 'desktop' | 'mobile';

// Touch-first devices (phones, tablets) get the LinkedIn-app walkthrough; everything else the browser one.
export const MOBILE_GUIDE_QUERY = '(hover: none) and (pointer: coarse)';

export function linkedinUrlGuide(device: GuideDevice, supabaseUrl: string = getSupabaseUrl()) {
  const base = `${new URL(supabaseUrl).origin}/storage/v1/object/public/${GUIDE_BUCKET}/linkedin-url-${device}`;
  return {
    videoSrc: `${base}.mp4?v=${GUIDE_VERSION}`,
    posterSrc: `${base}-poster.jpg?v=${GUIDE_VERSION}`,
  };
}
