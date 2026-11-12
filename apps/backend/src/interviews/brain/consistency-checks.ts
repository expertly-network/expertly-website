import type { Claim, ClaimFlag, MemberContext, ModelClaim } from './types';

// Work claimed before the regime existed (spec §4.1). Year granularity: GST started July 2017,
// so any claim starting before 2017 is flagged.
export const REGIMES: readonly { key: string; startYear: number; pattern: RegExp }[] = [
  { key: 'GST', startYear: 2017, pattern: /\b(gst|goods and services tax)\b/i },
  { key: 'IBC', startYear: 2016, pattern: /\b(ibc|insolvency and bankruptcy code|cirp)\b/i },
  { key: 'DPDP', startYear: 2023, pattern: /\b(dpdp|digital personal data protection)\b/i },
];

const TOLERANCE_YEARS = 1;

interface Span {
  from: number;
  to: number | null; // null = still working
}

function careerSpan(member: MemberContext): Span | null {
  const items = member.workExperiences.filter(
    (w): w is { startYear: number; endYear?: number | null; isCurrent?: boolean } =>
      typeof w === 'object' && w !== null && Number.isInteger((w as { startYear?: unknown }).startYear)
  );
  if (!items.length) return null;
  const from = Math.min(...items.map((w) => w.startYear));
  if (items.some((w) => w.isCurrent === true)) return { from, to: null };
  const ends = items.map((w) => (Number.isInteger(w.endYear) ? (w.endYear as number) : w.startYear));
  return { from, to: Math.max(...ends) };
}

export function addConsistencyFlags(claims: ModelClaim[], member: MemberContext): Claim[] {
  const span = careerSpan(member);
  return claims.map((c) => {
    const flags: ClaimFlag[] = [];
    if (c.source === 'selected_service') flags.push('selected_no_evidence');
    if (c.periodFrom !== null && REGIMES.some((r) => r.pattern.test(c.text) && c.periodFrom! < r.startYear))
      flags.push('regime_before_start');
    if (span) {
      const tooEarly = c.periodFrom !== null && c.periodFrom < span.from - TOLERANCE_YEARS;
      const tooLate = span.to !== null && c.periodTo !== null && c.periodTo > span.to + TOLERANCE_YEARS;
      if (tooEarly || tooLate) flags.push('timeline_conflict');
    }
    return { ...c, flags };
  });
}
