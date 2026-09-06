// Client feedback (2026-08-31): on a validation error or missing mandatory field, the applicant
// should be scrolled to the relevant field with the error highlighted (red), not just silently
// blocked from advancing. Each step computes a `Record<fieldName, message>` (fieldName matching
// that field's `id`/`name`) and calls this before showing it.
export function scrollToFirstError(errors: Record<string, string>) {
  const firstKey = Object.keys(errors)[0];
  if (!firstKey) return;

  // Deferred one frame — the error state (and therefore the red border) must actually be in the
  // DOM before we scroll/focus, otherwise this races the re-render on the first click.
  requestAnimationFrame(() => {
    const el = document.getElementById(firstKey);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el instanceof HTMLElement && typeof el.focus === 'function') el.focus({ preventScroll: true });
  });
}
