// Opens the site-wide AI search modal (owned by FloatingSearch, mounted once in AppShell) from
// anywhere on the page, e.g. the homepage's "AI search" channel pill. A window event keeps callers
// decoupled from where the modal lives.
export const OPEN_SEARCH_EVENT = 'growxq:open-search';

export function openSearch() {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}
