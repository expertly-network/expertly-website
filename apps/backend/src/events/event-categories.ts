// Infers an event's topic categories (taxonomy level 2) from its title and description, for events
// created or imported without explicit `categoryIds` — the imports carry no taxonomy at all. Plain
// keyword rules, deterministic and free: a title match counts double, the top 3 categories with any
// match are kept, and an event that matches nothing stays untagged rather than guessing.

const RULES: { category: string; patterns: RegExp[] }[] = [
  {
    category: 'Direct Tax',
    patterns: [
      /\bincome[- ]tax/i,
      /\bdirect tax/i,
      /\btransfer pricing\b/i,
      /\bTDS\b|\bTCS\b/,
      /\bcapital gains?\b/i,
      /\bcorporate (income )?tax/i,
      /\binternational tax/i,
      /\bcross[- ]border tax/i,
      /\bBEPS\b|\bpillar (one|two|2)\b/i,
      /\bDTAA\b|\btax treat(y|ies)\b/i,
      /\bwithholding tax/i,
      /\bresidential status\b/i,
      /\b(ITR|tax return)s?\b/i,
      /\bSALT\b|\bstate and local tax/i,
      /\bfaceless assessment\b|\breassessment\b/i,
      /\bminimum tax\b/i,
      /\bpayroll tax/i,
      /\bTEI\b|\bNTPI\b|\bbudget 20\d\d\b/,
    ],
  },
  {
    category: 'Indirect Tax',
    patterns: [
      /\bGST\b|\bGSTAT\b|\bgoods and services tax/i,
      /\bVAT\b|\bvalue[- ]added tax/i,
      /\bcustoms\b/i,
      /\bexcise\b/i,
      /\bsales tax/i,
      /\bindirect tax/i,
      /\be-?invoic(e|ing)\b/i,
      /\btariffs?\b/i,
    ],
  },
  {
    category: 'Other taxes & duties',
    patterns: [/\bstamp duty\b/i, /\bproperty tax\b/i],
  },
  {
    category: 'Corporate compliances & Secretarial assistance',
    patterns: [
      /\bcompan(y|ies) (law|act)\b/i,
      /\bMCA\b|\bROC\b/,
      /\bsecretarial\b/i,
      /\bcorporate governance\b/i,
      /\bboard (meeting|of directors|room|evaluation)\b/i,
      /\bAGM\b|\bannual general meeting\b/i,
      /\bLLP\b/,
      /\bXBRL\b/,
      /\bbeneficial owner/i,
      /\bLODR\b|\blisting (obligations|regulations)\b/i,
      /\bCSR\b|\bcorporate social responsibility\b/i,
      /\bincorporation\b|\bentity (formation|setup)\b/i,
      /\bgovernance\b|\bdirectors?'?\b/i,
      /\bannual return/i,
    ],
  },
  {
    category: 'Accounting & related compliances',
    patterns: [
      /\baccounting\b|\baccountancy\b/i,
      /\bIFRS\b|\bInd ?AS\b|\bUS GAAP\b|\bGAAP\b|\bSFRS/i,
      /\bfinancial (reporting|statements?)\b/i,
      /\bconsolidation\b/i,
      /\bbook-?keeping\b/i,
      /\bCFO\b|\bfinance (leaders?|function|team)\b/i,
      /\bFP&A\b|\bbudgeting\b|\bforecasting\b/i,
      /\btreasury\b|\bcash flow\b/i,
      /\bMIS\b|\bmanagement reporting\b/i,
      /\bERP\b|\bTally\b|\bSAP\b/,
      /\bpayroll\b/i,
      /\bexcel\b|\bAICPA\b|\bCPA\b/i,
    ],
  },
  {
    category: 'Audit & Assurance',
    patterns: [
      /\baudit(s|ing|or|ors)?\b/i,
      /\bassurance\b/i,
      /\binternal (controls?|financial controls?)\b|\bICFR\b|\bSOX\b|\bIFC\b/i,
      /\bforensic\b|\bfraud\b/i,
      /\bvaluation\b/i,
      /\bdue diligence\b/i,
      /\brisk management\b|\benterprise risk\b/i,
      /\bSOC ?[12]\b/i,
    ],
  },
  {
    category: 'Investment Banking',
    patterns: [
      /\bIPOs?\b|\binitial public offering/i,
      /\binvestment bank/i,
      /\bfund ?raising\b|\bcapital rais/i,
      /\bSME (IPO|exchange|listing)\b/i,
      /\bpre-IPO\b/i,
    ],
  },
  {
    category: 'Corporate, M&A & Capital Markets',
    patterns: [
      /\bM&A\b|\bmergers?\b|\bacquisitions?\b|\bamalgamation\b/i,
      /\bcapital markets?\b/i,
      /\bSEBI\b|\bsecurities (law|regulation)/i,
      /\bprivate equity\b|\bventure capital\b/i,
      /\bstart-?ups?\b/i,
      /\bcontract(s|ual)? law\b|\bcommercial contracts?\b/i,
      /\bcorporate law\b/i,
      /\bjoint ventures?\b/i,
      /\bsecurities\b|\bstock exchange\b|\btokeni[sz]ation\b|\bsecondaries\b/i,
      /\bin-house (lawyers?|legal|counsel)\b|\bLLC\b/i,
    ],
  },
  {
    category: 'Banking, Finance & Insolvency',
    patterns: [
      /\binsolvency\b|\bIBC\b|\bbankruptcy\b/i,
      /\brestructuring\b|\bturnaround\b/i,
      /\bbanking\b|\bNBFC\b|\bRBI\b/i,
      /\bfintech\b|\bpayments?\b/i,
      /\bsecuriti[sz]ation\b|\bstructured finance\b/i,
      /\bSARFAESI\b|\bdebt recovery\b/i,
      /\bcredit (risk|management)\b|\blending\b/i,
      /\bfinancial distress\b/i,
    ],
  },
  {
    category: 'Dispute Resolution & Investigations',
    patterns: [
      /\barbitration\b|\barbitral\b|\bmediation\b/i,
      /\blitigation\b|\bdisputes?\b/i,
      /\bwhite[- ]collar\b|\binvestigations?\b/i,
      /\bclass actions?\b/i,
      /\btribunal\b|\bcourt\b/i,
      /\bproduct liability\b/i,
      /\btrials?\b|\bwitness(es)?\b|\bthe bench\b|\baccess to justice\b/i,
    ],
  },
  {
    category: 'Regulatory, Competition & Public Law',
    patterns: [
      /\bcompetition law\b|\bantitrust\b/i,
      /\banti-?bribery\b|\bcorruption\b|\bFCPA\b/i,
      /\bsanctions?\b|\bexport controls?\b/i,
      /\bFEMA\b|\bFDI\b|\bforeign (direct )?investment\b|\bexchange control/i,
      /\bpublic policy\b|\badministrative law\b/i,
      /\bAML\b|\banti-?money laundering\b|\bKYC\b/i,
      /\bFCA\b|\bregulator(y|s)?\b|\bsupervis(ion|ory)\b/i,
    ],
  },
  {
    category: 'Data Protection, Technology & IP',
    patterns: [
      /\bdata protection\b|\bprivacy\b|\bGDPR\b|\bDPDP/i,
      /\bcyber/i,
      /\bartificial intelligence\b|\bgenerative AI\b|\bAI\b/,
      /\bintellectual property\b|\bpatents?\b|\btrade ?marks?\b|\bcopyright\b/i,
      /\btechnology law\b|\bTMT\b/i,
    ],
  },
  {
    category: 'Employment & Immigration',
    patterns: [
      /\bemployment\b|\blabou?r (law|code)s?\b/i,
      /\bimmigration\b|\bvisas?\b/i,
      /\bsocial security\b|\bPOSH\b|\bworkplace\b/i,
    ],
  },
  {
    category: 'Real Estate, Infrastructure & Environment',
    patterns: [
      /\breal estate\b|\bRERA\b/i,
      /\binfrastructure\b|\bconstruction\b/i,
      /\benergy\b|\brenewables?\b/i,
      /\benvironment(al)?\b|\bclimate\b|\bESG\b|\bsustainab/i,
    ],
  },
  {
    category: 'Private Client, Family & Wealth',
    patterns: [
      // "will" alone is the future tense, so only plural/compound forms count.
      /\bsuccession\b|\bestate planning\b|\bwills\b|\bwill (drafting|writing|and)\b/i,
      /\bfamily (office|business|law|settlement)s?\b/i,
      /\bprivate (client|trust|wealth)s?\b|\bwealth management\b/i,
      /\binheritance\b/i,
    ],
  },
  {
    category: 'Sector-Specific Practices',
    patterns: [
      /\baviation\b/i,
      /\bhealthcare\b|\blife sciences?\b|\bpharma/i,
      /\binsurance\b/i,
      /\bmaritime\b|\bshipping\b|\blogistics\b/i,
    ],
  },
  {
    category: 'Notarial & Admin Services',
    patterns: [/\bnotar(y|ial)\b/i, /\bapostille\b|\blegali[sz]ation\b/i],
  },
];

const MAX_CATEGORIES = 3;
const TAX_CATEGORIES = new Set(['Direct Tax', 'Indirect Tax', 'Other taxes & duties']);
const GENERIC_TAX = /\btax(ation|es)?\b/i;

// Category *names* for the event, best match first.
export function inferEventCategoryNames(title: string, description: string | null): string[] {
  const scored: { category: string; score: number }[] = [];
  for (const rule of RULES) {
    let score = 0;
    for (const pattern of rule.patterns) {
      if (pattern.test(title)) score += 2;
      if (description && pattern.test(description)) score += 1;
    }
    if (score > 0) scored.push({ category: rule.category, score });
  }
  // A bare "tax"/"taxation" only says Direct Tax when no specific tax category already matched
  // (a GST or stamp-duty event mentions "tax" too).
  if (!scored.some((s) => TAX_CATEGORIES.has(s.category))) {
    const score = (GENERIC_TAX.test(title) ? 2 : 0) + (description && GENERIC_TAX.test(description) ? 1 : 0);
    if (score > 0) scored.push({ category: 'Direct Tax', score });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CATEGORIES)
    .map((s) => s.category);
}

// Same, resolved to ids against the live category list (names that no longer exist are skipped).
export function inferEventCategoryIds(
  title: string,
  description: string | null,
  categoryIdByName: Map<string, string>
): string[] {
  return inferEventCategoryNames(title, description)
    .map((name) => categoryIdByName.get(name))
    .filter((id): id is string => !!id);
}
