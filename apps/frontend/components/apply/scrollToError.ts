// Scrolls to and focuses the first field with a validation error.
export function scrollToFirstError(errors: Record<string, string>) {
  const firstKey = Object.keys(errors)[0];
  if (!firstKey) return;

  // Deferred one frame so the error state is in the DOM before scrolling.
  requestAnimationFrame(() => {
    const el = document.getElementById(firstKey);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (el instanceof HTMLElement && typeof el.focus === 'function') el.focus({ preventScroll: true });
  });
}
