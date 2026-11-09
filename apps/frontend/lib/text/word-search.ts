// Word-prefix search shared by the service picker (components/ui/Combobox.tsx) and the service guide
// table (components/apply/ServiceGuide.tsx), so both find the same things for the same query.
//
// Each query word must be the start of some word in the text, in any order, so "corporate tax"
// finds "Corporate Income tax / Federal Tax" and "m&a tax" finds "M&A / Transaction Tax" but not
// "Fund & Investment Management Tax". "&" is kept as part of a word ("M & A" reads as "m&a"); a
// query word typed without one also matches with it dropped, so "ma" still finds "M&A". On the text
// side each joined word also counts as its parts, so "privacy" still finds "Data Protection &
// Privacy" (otherwise indexed only as "protection&privacy").

function words(s: string): string[] {
  return (
    s
      .toLowerCase()
      .replace(/\s*&\s*/g, '&')
      .replace(/[^a-z0-9&]+/g, ' ')
      .trim()
      .split(' ')
      // An "&" with no letter on one side ("(UBO) & KYC" → "&kyc", or a lone "&") belongs to no word.
      .map((w) => w.replace(/^&+|&+$/g, ''))
      .filter(Boolean)
  );
}

export function queryWords(query: string): string[] {
  return words(query);
}

/** True when every query word starts some word in `text`; an empty query matches everything. */
export function matchesWords(text: string, query: string[]): boolean {
  if (query.length === 0) return true;
  const textWords = words(text).flatMap((w) => (w.includes('&') ? [w, ...w.split('&').filter(Boolean)] : [w]));
  return query.every((q) =>
    textWords.some((w) => w.startsWith(q) || (!q.includes('&') && w.replace(/&/g, '').startsWith(q)))
  );
}
