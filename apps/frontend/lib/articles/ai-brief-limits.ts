// Mirrors AI_BRIEF_LIMITS in apps/backend/src/ai/dto/word-limits.ts — the API rejects a brief
// outside these bounds; these give live feedback first. Change both together.
export const AI_BRIEF_LIMITS = {
  topic: { min: 3, max: 25 },
  notes: { min: 25, max: 600 },
  recentDevelopments: { min: 0, max: 400 },
  advice: { min: 10, max: 400 },
  followUpAnswer: { min: 0, max: 250 },
} as const;

export const MAX_SOURCE_LINKS = 5;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Null when within bounds, otherwise the message to show under the field.
export function wordLimitError(text: string, limit: { min: number; max: number }, what: string): string | null {
  const n = countWords(text);
  if (limit.min > 0 && n < limit.min) {
    return n === 0
      ? `Add ${what} (at least ${limit.min} words).`
      : `Too short — at least ${limit.min} words, so the AI has something real to write from (${n} so far).`;
  }
  if (n > limit.max) return `Too long — keep it to ${limit.max} words (${n} now).`;
  return null;
}

// The links textarea, one per line: each must be a full http(s) URL; at most MAX_SOURCE_LINKS.
export function parseSourceLinks(text: string): { links: string[]; error: string | null } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > MAX_SOURCE_LINKS) {
    return { links: lines, error: `Add at most ${MAX_SOURCE_LINKS} links (${lines.length} now).` };
  }
  for (const line of lines) {
    let url: URL | null = null;
    try {
      url = new URL(line);
    } catch {
      url = null;
    }
    if (
      !url ||
      (url.protocol !== 'http:' && url.protocol !== 'https:') ||
      !url.hostname.includes('.') ||
      line.length > 2048
    ) {
      return {
        links: lines,
        error: `"${line.length > 60 ? `${line.slice(0, 57)}…` : line}" isn't a valid link. Use a full address starting with https://`,
      };
    }
  }
  return { links: lines, error: null };
}
