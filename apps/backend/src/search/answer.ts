import type { SearchResult } from './search.types';
import { resultTitle } from './search.types';

// The short answer shown above the results, composed from the results actually returned (never by
// the LLM), so it can only name what the user can see. The judge supplies a one-line `reason` per
// result; the answer names the best matches and repeats the top one's reason.

const MAX_NAMED = 3;
const MAX_TITLE = 60;

function shortTitle(r: SearchResult): string {
  const t = resultTitle(r).trim();
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1).trimEnd()}…` : t;
}

/** "A", "A and B", "A, B and C". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Lower-cases the first letter after "—" only for an ordinary opening word ("Prepares transfer…"),
 * never for a name or title ("Transfer Pricing webinar…", "GST on…"). */
function lowerFirst(text: string): string {
  const [first = '', second = ''] = text.split(/\s+/);
  const ordinary = /^[A-Z][a-z]+$/.test(first) && (!second || /^[a-z]/.test(second));
  return ordinary ? `${text.charAt(0).toLowerCase()}${text.slice(1)}` : text;
}

function sentence(text: string): string {
  const t = text.trim().replace(/[.;,\s]+$/, '');
  return t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : '';
}

/**
 * `scored` = the judge ranked these results (topic questions); otherwise they are plain filter
 * matches with no match labels. `notes` are deterministic remarks (e.g. a relaxed filter) shown
 * first.
 */
export function composeAnswer(results: SearchResult[], scored: boolean, notes: string[]): string {
  const parts = [...notes];
  if (results.length === 0) {
    parts.push('I could not find a strong match for that in the directory.');
    return parts.join(' ');
  }
  if (!scored) {
    parts.push(`Showing ${results.length} result${results.length === 1 ? '' : 's'} that match your filters.`);
    return parts.join(' ');
  }

  const best = results.filter((r) => r.match?.tier !== 'related');
  const lead = best.length > 0 ? best : results;
  const named = lead.slice(0, MAX_NAMED).map(shortTitle);
  // The top result's reason is folded into the same sentence ("Best match: A — reason.") rather than
  // repeating its name; with several matches it follows as "A stands out — reason."
  const topReason = lead[0].reason?.trim();
  const because = topReason ? ` — ${lowerFirst(sentence(topReason))}` : '.';
  if (best.length > 0) {
    if (named.length === 1) {
      parts.push(`Best match: ${named[0]}${because}`);
    } else {
      parts.push(`Best matches: ${joinNames(named)}.`);
      if (topReason) parts.push(`${named[0]} stands out${because}`);
    }
  } else {
    parts.push(`No strong match was found; the closest ${named.length === 1 ? 'is' : 'are'} ${joinNames(named)}.`);
  }
  return parts.join(' ');
}
