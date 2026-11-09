// Optional extra guidance per practice category, keyed by category NAME (stable across
// environments, unlike ids). Only Direct Tax for now, for testing (spec §5). Everything else runs
// on the generic target schema alone.
const CATEGORY_HINTS: Record<string, string> = {
  'Direct Tax': `The service list is international (Federal Tax, SALT, Transfer pricing...), so establish
the jurisdiction(s) first; never assume India.
- Which jurisdictions and taxpayer types (individuals/expats, corporates, funds, partnerships, non-profits) they mainly serve.
- For their listed services, one hands-on example each. Transfer pricing: benchmarking approach when comparables were weak, documentation, audit defence. M&A / transaction tax: structuring choices, tax due diligence findings that changed a deal. International / cross-border: treaty positions, permanent-establishment risk, withholding.
- Disputes: which forums they have handled (tax authority audits/assessments, appeals tribunals, courts), their role (drafting, arguing, strategy), and outcomes.
- Advisory vs compliance mix; recurring compliance scale (number of returns or entities).
- Tax technology and controls work if listed (ERP tax set-up, tax control frameworks, analytics).
- How they keep current with law changes, and a recent change that affected their clients.`,
};

export function categoryHintsFor(categoryNames: string[]): string[] {
  return [...new Set(categoryNames)].flatMap((name) => {
    const hint = CATEGORY_HINTS[name];
    return hint ? [`${name}:\n${hint}`] : [];
  });
}
