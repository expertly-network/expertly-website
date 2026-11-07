// Shared references to the approved logo, selected by the surface it sits on.
// Bump the version when replacing artwork to invalidate browser/CDN caches.
const LOGO_VERSION = 12;
export const LOGO_SRC = {
  light: `/brand/growxq-logo-light.svg?v=${LOGO_VERSION}`,
  dark: `/brand/growxq-logo-dark.svg?v=${LOGO_VERSION}`,
} as const;
export const FAVICON_SRC = {
  light: `/brand/favicon-on-light.svg?v=${LOGO_VERSION}`,
  dark: `/brand/favicon-on-dark.svg?v=${LOGO_VERSION}`,
} as const;
// Raster fallbacks: link-preview crawlers (WhatsApp, LinkedIn, Slack, Google) ignore SVG icons.
export const FAVICON_PNG_SRC = `/brand/favicon-192.png?v=${LOGO_VERSION}`;
export const OG_IMAGE_SRC = `/brand/og-image.png?v=${LOGO_VERSION}`;
// The pre-launch teaser's share card (app/welcome/page.tsx): the invitation, not just the logo.
export const OG_FOUNDING_IMAGE_SRC = `/brand/og-founding.png?v=${LOGO_VERSION}`;
export const LOGO_ASPECT_RATIO = 299 / 61;
export const LOGO_MARK_ASPECT_RATIO = 62 / 61;
export const BRAND_ICON_SRC = FAVICON_SRC.dark;
