/**
 * Rounds a real count DOWN to a friendly figure to show with a "+" (26 → 25+, 7 → 5+, 19 → 15+),
 * so the claim is always true and doesn't need updating with every new member. Under 5 the exact
 * number is shown (2 → 2+); zero stays 0 with no plus. Steps: 5 below 100, 50 below 1,000,
 * 100 above.
 */
export function floorStat(n: number): { value: number; plus: boolean } {
  const count = Math.max(0, Math.floor(n));
  if (count === 0) return { value: 0, plus: false };
  const step = count < 5 ? 1 : count < 100 ? 5 : count < 1000 ? 50 : 100;
  return { value: Math.floor(count / step) * step, plus: true };
}
