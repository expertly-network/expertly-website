import { describe, expect, it } from 'vitest';
import { SIGNAL_NAMES, type InterviewScoringResultDto } from '@shared/interview';
import {
  buildFlags,
  buildProposals,
  computeEvidence,
  findQuote,
  finaliseScoring,
  isVerified,
  numberTranscript,
  scoringModelSchema,
  type ScoringModelOutput,
} from './scoring';
import type { ClaimLedger, InterviewPlanV2, TranscriptTurn } from './types';

type Rating = 'supports' | 'weakens' | 'not_tested';
const sig = (rating: Rating, turn: number | null = null, quote: string | null = null) => ({ rating, turn, quote });
const signals = (supports: number, weakens: number, consistencyWeak = false) =>
  Object.fromEntries(
    SIGNAL_NAMES.map((n, i) => {
      if (n === 'consistency' && consistencyWeak) return [n, sig('weakens', 2, 'that was in 2012')];
      if (i < supports) return [n, sig('supports', 2, 'i drafted the functional analysis')];
      if (i < supports + weakens) return [n, sig('weakens', 4, 'the firm handled that')];
      return [n, sig('not_tested')];
    })
  ) as Parameters<typeof computeEvidence>[0];

const TRANSCRIPT: TranscriptTurn[] = [
  { role: 'agent', message: 'Pick one engagement.', timeInCallSecs: 0 },
  { role: 'user', message: 'I drafted the functional analysis, and that was in 2012.', timeInCallSecs: 5 },
  { role: 'agent', message: 'What was your part?', timeInCallSecs: 20 },
  { role: 'user', message: 'Honestly the firm handled that, I was on the team.', timeInCallSecs: 25 },
];

describe('computeEvidence', () => {
  it('applies the rubric in order: EX, E0, E3, E2, E1', () => {
    expect(computeEvidence(signals(5, 0, true))).toBe('EX');
    expect(computeEvidence(signals(4, 2))).toBe('E0');
    expect(computeEvidence(signals(5, 0))).toBe('E3');
    expect(computeEvidence(signals(5, 1))).toBe('E2');
    expect(computeEvidence(signals(3, 1))).toBe('E2');
    expect(computeEvidence(signals(2, 0))).toBe('E1');
    expect(computeEvidence(signals(0, 1))).toBe('E1');
  });
});

describe('findQuote', () => {
  it('finds a quote in a member turn regardless of case and punctuation', () => {
    expect(findQuote('i drafted the Functional Analysis', 2, TRANSCRIPT)).toBe(2);
  });
  it('corrects a wrong turn number', () => expect(findQuote('the firm handled that', 2, TRANSCRIPT)).toBe(4));
  it('rejects quotes from the interviewer or invented text', () => {
    expect(findQuote('what was your part', 3, TRANSCRIPT)).toBeNull();
    expect(findQuote('we won at the tribunal', 2, TRANSCRIPT)).toBeNull();
  });
});

const PLAN: InterviewPlanV2 = { schemaVersion: 2, baselineClaimId: 'c1', claimIds: ['c1', 'c2'], opening: 'O' };
const LEDGER: ClaimLedger = {
  claims: [
    {
      id: 'c1',
      text: 'TP',
      serviceIds: ['s-tp'],
      type: 'engagement',
      periodFrom: null,
      periodTo: null,
      source: 'bio',
      flags: [],
    },
    {
      id: 'c2',
      text: 'M&A tax',
      serviceIds: ['s-ma'],
      type: 'specialisation',
      periodFrom: null,
      periodTo: null,
      source: 'selected_service',
      flags: [],
    },
    {
      id: 'c3',
      text: 'Audit',
      serviceIds: ['s-au'],
      type: 'engagement',
      periodFrom: null,
      periodTo: null,
      source: 'bio',
      flags: [],
    },
  ],
};
const emptyFacets = {
  jurisdiction: [],
  instrument: [],
  work_type: [],
  forum: [],
  client_type: [],
  industry: [],
  scale: [],
  volume: [],
  recencyYear: null,
};
const rawClaim = (o: object) => ({
  claimId: 'c1',
  probed: true,
  concreteDetails: ['functional analysis'],
  signals: signals(5, 0),
  role: 5,
  evidence: 'E3' as const,
  technical: [],
  lowConfidenceTerms: [],
  facets: { ...emptyFacets, jurisdiction: ['India'], recencyYear: 2025 },
  creditServiceIds: ['s-tp', 's-x'],
  candidateSubtags: [],
  evidenceSummary: 'Drafted the functional analysis for an APA. Contact a@b.com.',
  ...o,
});
const ctx = {
  ledger: LEDGER,
  plan: PLAN,
  transcript: TRANSCRIPT,
  allowedServiceIds: new Set(['s-tp', 's-ma', 's-dd']),
  anchoredServiceIds: new Set<string>(),
  elapsedSeconds: 840,
  wrapUpDone: true,
  rubricVersion: 'r1',
};

describe('scoringModelSchema', () => {
  it('asks for concrete details and signals before the role and evidence level', () => {
    const keys = Object.keys(scoringModelSchema.shape.claims.element.shape);
    expect(keys.slice(0, 6)).toEqual(['claimId', 'probed', 'concreteDetails', 'signals', 'role', 'evidence']);
  });
});

describe('finaliseScoring', () => {
  it('fills NP for claims the model skipped and keeps the model evidence for comparison', () => {
    const raw: ScoringModelOutput = { claims: [rawClaim({})], adjacentServices: [], searchTerms: [] };
    const r = finaliseScoring(raw, ctx);
    expect(r.claims.map((c) => [c.claimId, c.evidence])).toEqual([
      ['c1', 'E3'],
      ['c2', 'NP'],
      ['c3', 'NP'],
    ]);
    expect(r.claims[0].modelEvidence).toBe('E3');
    expect(r.interviewQuality).toEqual({ minutes: 14, claimsProbed: 1, endedEarly: false });
  });
  it('drops credit ids outside the allowed set and redacts the summary', () => {
    const r = finaliseScoring({ claims: [rawClaim({})], adjacentServices: [], searchTerms: [] }, ctx);
    expect(r.claims[0].creditServiceIds).toEqual(['s-tp']);
    expect(r.claims[0].evidenceSummary).not.toContain('a@b.com');
  });
  it('turns unverifiable quotes into not_tested and recomputes evidence', () => {
    const bad = signals(5, 0);
    bad.specificity = sig('supports', 2, 'an invented quote');
    const r = finaliseScoring({ claims: [rawClaim({ signals: bad })], adjacentServices: [], searchTerms: [] }, ctx);
    expect(r.claims[0].signals.specificity.rating).toBe('not_tested');
    expect(r.claims[0].evidence).toBe('E2'); // 4 supports left
  });
  it('clears facets for firm-level roles and forces technical_unverified without anchors', () => {
    const r = finaliseScoring(
      {
        claims: [
          rawClaim({
            role: 1,
            technical: [{ kind: 'anchor_match', turn: 2, quote: 'i drafted the functional analysis' }],
          }),
        ],
        adjacentServices: [],
        searchTerms: [],
      },
      ctx
    );
    expect(r.claims[0].facets.jurisdiction).toEqual([]);
    expect(r.claims[0].technical[0].kind).toBe('technical_unverified');
  });
  it('keeps an empty summary empty instead of falling back to the raw (unredacted) claim text', () => {
    const r = finaliseScoring(
      { claims: [rawClaim({ evidenceSummary: '  ' })], adjacentServices: [], searchTerms: [] },
      ctx
    );
    expect(r.claims[0].evidenceSummary).toBe('');
    expect(buildProposals(r, [])).toEqual([]);
  });
  it('keeps a null model role as null (unknown), with no facets or subtags', () => {
    const r = finaliseScoring({ claims: [rawClaim({ role: null })], adjacentServices: [], searchTerms: [] }, ctx);
    expect(r.claims[0].role).toBeNull();
    expect(r.claims[0].facets.jurisdiction).toEqual([]);
  });
});

const scored = (claims: Partial<InterviewScoringResultDto['claims'][number]>[]): InterviewScoringResultDto =>
  ({
    rubricVersion: 'r1',
    adjacentServices: [],
    searchTerms: [],
    interviewQuality: { minutes: 14, claimsProbed: claims.length, endedEarly: false },
    claims: claims.map((c, i) => ({
      claimId: `c${i + 1}`,
      claimText: `claim ${i + 1}`,
      serviceIds: [`s${i + 1}`],
      probed: true,
      role: 4,
      evidence: 'E2',
      modelEvidence: 'E2',
      signals: signals(3, 0),
      technical: [],
      lowConfidenceTerms: [],
      facets: { ...emptyFacets },
      creditServiceIds: [`s${i + 1}`],
      candidateSubtags: [],
      evidenceSummary: 'summary',
      ...c,
    })),
  }) as InterviewScoringResultDto;

describe('buildProposals', () => {
  it('proposes only R2+ claims with E1–E3, keeping the strongest claim per service', () => {
    const r = scored([
      { role: 3, evidence: 'E2', creditServiceIds: ['s-tp'] },
      { role: 5, evidence: 'E3', creditServiceIds: ['s-tp'] },
      { role: 1, evidence: 'E3', creditServiceIds: ['s-ma'] },
      { role: 4, evidence: 'E0', creditServiceIds: ['s-dd'] },
    ]);
    const p = buildProposals(r, []);
    expect(p.map((x) => [x.serviceId, x.claimId])).toEqual([['s-tp', 'c2']]);
  });
  it('gives a claim with an anchor_conflict flag no proposal, even at E2', () => {
    const technical = [{ kind: 'anchor_conflict' as const, turn: 2, quote: 'x' }];
    const r = scored([{ role: 4, evidence: 'E2', technical, creditServiceIds: ['s-tp'] }]);
    const flags = buildFlags(r, new Set(), new Set());
    expect(flags.map((f) => f.reason)).toEqual(['anchor_conflict']);
    expect(buildProposals(r, flags)).toEqual([]);
  });
  it('gives any flagged claim (firm_level_on_selected, unsupported) no proposal', () => {
    const r = scored([
      { role: 4, evidence: 'E2', creditServiceIds: ['s-tp'] },
      { role: 4, evidence: 'E2', creditServiceIds: ['s-ma'] },
      { role: 4, evidence: 'E2', creditServiceIds: ['s-dd'] },
    ]);
    const flag = (claimId: string, reason: 'firm_level_on_selected' | 'unsupported') => ({
      claimId,
      claimText: 'x',
      serviceIds: [],
      reason,
      evidence: [],
    });
    const p = buildProposals(r, [flag('c1', 'firm_level_on_selected'), flag('c2', 'unsupported')]);
    expect(p.map((x) => x.claimId)).toEqual(['c3']);
  });
  it('needs at least one verified supports signal: a probed R4/E1 claim with none gets no proposal and no flag', () => {
    const r = scored([{ role: 4, evidence: 'E1', signals: signals(0, 0), creditServiceIds: ['s-tp'] }]);
    const flags = buildFlags(r, new Set(['s1']), new Set(['s1']));
    expect(flags).toEqual([]);
    expect(buildProposals(r, flags)).toEqual([]);
  });
  it('skips a claim whose summary is empty', () => {
    expect(buildProposals(scored([{ evidenceSummary: '' }]), [])).toEqual([]);
  });
});

describe('buildFlags', () => {
  it('flags E0, EX and firm-level work on selected services, never anything else', () => {
    const r = scored([
      { evidence: 'E0', signals: signals(0, 2) },
      { evidence: 'EX', signals: signals(3, 0, true) },
      { role: 1, evidence: 'E1', serviceIds: ['sel'] },
      { role: 1, evidence: 'E1', serviceIds: ['not-selected'] },
      { role: 5, evidence: 'E3' },
    ]);
    const flags = buildFlags(r, new Set(['sel']), new Set());
    expect(flags.map((f) => [f.claimId, f.reason])).toEqual([
      ['c1', 'unsupported'],
      ['c2', 'contradicted'],
      ['c3', 'firm_level_on_selected'],
    ]);
    expect(flags[0].evidence.length).toBe(2);
  });
  it('does not read a null role on a selected service as firm-level work', () => {
    const r = scored([{ role: null, evidence: 'E1', serviceIds: ['sel'] }]);
    expect(buildFlags(r, new Set(['sel']), new Set())).toEqual([]);
  });
  it('creates technical_unverified only for anchored services', () => {
    const technical = [{ kind: 'technical_unverified' as const, turn: 2, quote: 'x' }];
    const r = scored([{ technical }]);
    expect(buildFlags(r, new Set(), new Set())).toEqual([]);
    expect(buildFlags(r, new Set(), new Set(['s1']))[0].reason).toBe('technical_unverified');
  });
});

describe('isVerified and numberTranscript', () => {
  it('is verified with one R2+ claim at E2+', () => {
    expect(isVerified(scored([{ role: 2, evidence: 'E2' }]))).toBe(true);
    expect(
      isVerified(
        scored([
          { role: 2, evidence: 'E1' },
          { role: 1, evidence: 'E3' },
        ])
      )
    ).toBe(false);
  });
  it('numbers turns from 1', () => {
    expect(numberTranscript(TRANSCRIPT).split('\n')[1]).toBe(
      '[2] MEMBER: I drafted the functional analysis, and that was in 2012.'
    );
  });
});
