import { matchesWords, queryWords } from '@/lib/text/word-search';
import type { CategoryDto } from '@shared/category';

export interface GuideLine {
  id: string;
  name: string;
  solutions: { id: string; name: string; problems: string[] }[];
}

// Alphabetical, except a catch-all "Other (please specify)" stays last.
function byName(a: string, b: string): number {
  const aOther = a.toLowerCase().startsWith('other');
  const bOther = b.toLowerCase().startsWith('other');
  if (aOther !== bOther) return aOther ? 1 : -1;
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

// The service guide's table rows for a search: service line → category → services, sorted. Words
// can come from any column: "corporate tax" finds "Corporate Income tax / Federal Tax", and
// "direct tax corporate" finds it via its subcategory. A subcategory that matches on its own (with
// its category) shows all of its services.
export function serviceGuideLines(categories: CategoryDto[], query: string): GuideLine[] {
  const q = queryWords(query);
  const lines = new Map<string, GuideLine>();
  for (const c of categories) {
    const path = `${c.serviceLineName} ${c.name}`;
    const matchesSolution = matchesWords(path, q);
    const problems = c.services
      .map((s) => s.name)
      .filter((name) => matchesSolution || matchesWords(`${path} ${name}`, q));
    if (!problems.length && !matchesSolution) continue;
    const line = lines.get(c.serviceLineId) ?? { id: c.serviceLineId, name: c.serviceLineName, solutions: [] };
    line.solutions.push({ id: c.id, name: c.name, problems });
    lines.set(c.serviceLineId, line);
  }
  const sorted = [...lines.values()].sort((a, b) => byName(a.name, b.name));
  for (const line of sorted) {
    line.solutions.sort((a, b) => byName(a.name, b.name));
    for (const s of line.solutions) s.problems.sort(byName);
  }
  return sorted;
}
