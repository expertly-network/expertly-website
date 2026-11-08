// Shared phone-layout constants. Tailwind scans lib/, so these literal class strings are generated.

/**
 * `top` for anything that sticks under the sticky mobile top bar (MobileDrawer, 62px tall below
 * 1024px) — 1px less so the two borders overlap instead of doubling. Use it instead of repeating
 * the magic number; if the top bar's height changes, change it here.
 */
export const STICKY_UNDER_MOBILE_BAR = 'top-[61px]';
