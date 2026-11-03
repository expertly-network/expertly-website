// Brand artwork uses the designer's symbol and outlined Cormorant Garamond (500) lettering.

// Bump when the artwork changes: the paths don't, so without it browsers and CDNs keep the old file.
const LOGO_VERSION = 6;

export const LOGO_SRC = {
  light: `/brand/logo-on-light.svg?v=${LOGO_VERSION}`,
  dark: `/brand/logo-on-dark.svg?v=${LOGO_VERSION}`,
} as const;
export const LOGO_ASPECT_RATIO = 301.972 / 60.6;

/** The symbol, per the surface it sits on (its second figure is dark on light, stone on dark). */
export const LOGO_MARK_SRC = {
  light: `/brand/mark-on-light.svg?v=${LOGO_VERSION}`,
  dark: `/brand/mark-on-dark.svg?v=${LOGO_VERSION}`,
} as const;

/** The standalone symbol is used by the collapsed sidebar. */
export const LOGO_MARK_ASPECT_RATIO = 64.4 / 60.6;
