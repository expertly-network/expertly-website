import { z } from 'zod';
import {
  EVIDENCE_LEVELS,
  SIGNAL_NAMES,
  type EvidenceLevel,
  type InterviewClaimScoreDto,
  type InterviewFlagEvidenceDto,
  type InterviewScoringResultDto,
  type InterviewSignalDto,
  type ReviewFlagReason,
  type SignalName,
} from '@shared/interview';
import { FACET_KINDS, type FacetKind } from '@shared/subtags';
import { redactCardText } from '../../search/redaction';
import type { ClaimLedger, InterviewPlanV2, TranscriptTurn } from './types';

// ---- model boundary (strict-schema safe: every field required, nullable instead of optional)

const signalSchema = z.object({
  rating: z.enum(['supports', 'weakens', 'not_tested']),
  turn: z.number().int().min(1).nullable(),
  quote: z.string().max(400).nullable(),
});
const signalsSchema = z.object({
  specificity: signalSchema,
  sequence: signalSchema,
  friction: signalSchema,
  constraints: signalSchema,
  i_we_split: signalSchema,
  third_party: signalSchema,
  variation: signalSchema,
  boundary: signalSchema,
  consistency: signalSchema,
  depth_gradient: signalSchema,
});
const facetList = z.array(z.string().min(1).max(80)).max(8);
const facetsSchema = z.object({
  jurisdiction: facetList,
  instrument: facetList,
  work_type: facetList,
  forum: facetList,
  client_type: facetList,
  industry: facetList,
  scale: facetList,
  volume: facetList,
  recencyYear: z.number().int().min(1950).max(2100).nullable(),
});
// Key order matters: the model lists concrete details and rates signals before it commits to a role.
// concreteDetails is a reasoning scaffold only (the model paraphrases it too often to verify in code).
const claimScoreSchema = z.object({
  claimId: z.string(),
  probed: z.boolean(),
  concreteDetails: z.array(z.string().max(200)).max(12),
  signals: signalsSchema,
  role: z.number().int().min(0).max(5).nullable(),
  evidence: z.enum(EVIDENCE_LEVELS),
  technical: z
    .array(
      z.object({
        kind: z.enum(['anchor_match', 'anchor_conflict', 'technical_unverified']),
        turn: z.number().int().min(1),
        quote: z.string().max(400),
      })
    )
    .max(10),
  lowConfidenceTerms: z.array(z.string().max(80)).max(10),
  facets: facetsSchema,
  creditServiceIds: z.array(z.string().max(40)).max(8),
  candidateSubtags: z.array(z.string().max(120)).max(6),
  evidenceSummary: z.string().max(600),
});
export const scoringModelSchema = z.object({
  claims: z.array(claimScoreSchema).max(20),
  adjacentServices: z.array(z.string().max(200)).max(10),
  searchTerms: z.array(z.string().max(120)).max(10),
});
export type ScoringModelOutput = z.infer<typeof scoringModelSchema>;
type Signals = Record<SignalName, InterviewSignalDto>;

// ---- rubric

export function computeEvidence(signals: Signals): EvidenceLevel {
  const ratings = SIGNAL_NAMES.map((n) => signals[n].rating);
  const supports = ratings.filter((r) => r === 'supports').length;
  const weakens = ratings.filter((r) => r === 'weakens').length;
  if (signals.consistency.rating === 'weakens') return 'EX';
  if (weakens >= 2) return 'E0';
  if (supports >= 5 && weakens === 0) return 'E3';
  if (supports >= 3 && weakens <= 1) return 'E2';
  return 'E1'; // probed, thin: 0–2 supports and at most one weakening signal
}

const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** 1-based turn of the member turn containing the quote (the given turn first), or null. */
export function findQuote(quote: string, turn: number | null, transcript: TranscriptTurn[]): number | null {
  const q = norm(quote);
  if (q.length < 3) return null;
  const isHit = (i: number): boolean => transcript[i]?.role === 'user' && norm(transcript[i].message).includes(q);
  if (turn !== null && isHit(turn - 1)) return turn;
  const idx = transcript.findIndex((_, i) => isHit(i));
  return idx === -1 ? null : idx + 1;
}

export function numberTranscript(transcript: TranscriptTurn[]): string {
  return transcript
    .map((t, i) => `[${i + 1}] ${t.role === 'user' ? 'MEMBER' : 'INTERVIEWER'}: ${t.message}`)
    .join('\n');
}

const emptyFacets = (): InterviewClaimScoreDto['facets'] => ({
  jurisdiction: [],
  instrument: [],
  work_type: [],
  forum: [],
  client_type: [],
  industry: [],
  scale: [],
  volume: [],
  recencyYear: null,
});
const untested = (): Signals =>
  Object.fromEntries(SIGNAL_NAMES.map((n) => [n, { rating: 'not_tested', turn: null, quote: null }])) as Signals;

export interface FinaliseContext {
  ledger: ClaimLedger;
  plan: InterviewPlanV2;
  transcript: TranscriptTurn[];
  allowedServiceIds: Set<string>;
  anchoredServiceIds: Set<string>;
  elapsedSeconds: number;
  wrapUpDone: boolean;
  rubricVersion: string;
}

export function finaliseScoring(raw: ScoringModelOutput, ctx: FinaliseContext): InterviewScoringResultDto {
  const byId = new Map(raw.claims.map((c) => [c.claimId, c]));
  const claims = ctx.ledger.claims.map((claim): InterviewClaimScoreDto => {
    const base = {
      claimId: claim.id,
      claimText: claim.text,
      serviceIds: claim.serviceIds,
    };
    const r = byId.get(claim.id);
    if (!r || !r.probed)
      return {
        ...base,
        probed: false,
        role: null,
        evidence: 'NP',
        modelEvidence: r?.evidence ?? 'NP',
        signals: untested(),
        technical: [],
        lowConfidenceTerms: [],
        facets: emptyFacets(),
        creditServiceIds: [],
        candidateSubtags: [],
        evidenceSummary: '',
      };
    const signals = Object.fromEntries(
      SIGNAL_NAMES.map((n) => {
        const s = r.signals[n];
        if (s.rating === 'not_tested' || !s.quote) return [n, { rating: 'not_tested', turn: null, quote: null }];
        const turn = findQuote(s.quote, s.turn, ctx.transcript);
        return [n, turn === null ? { rating: 'not_tested', turn: null, quote: null } : { ...s, turn }];
      })
    ) as Signals;
    const anchored = claim.serviceIds.some((id) => ctx.anchoredServiceIds.has(id));
    const technical = r.technical.flatMap((t) => {
      const turn = findQuote(t.quote, t.turn, ctx.transcript);
      if (turn === null) return [];
      return [{ ...t, turn, kind: anchored ? t.kind : ('technical_unverified' as const) }];
    });
    // A null model role stays null ("unknown"): it never earns R2+ outputs, and buildFlags does not
    // read it as firm-level work either.
    const role = r.role;
    const personal = (role ?? 0) >= 2;
    let credits = [...new Set(r.creditServiceIds.filter((id) => ctx.allowedServiceIds.has(id)))];
    if (!credits.length && personal) credits = claim.serviceIds.filter((id) => ctx.allowedServiceIds.has(id));
    return {
      ...base,
      probed: true,
      role,
      evidence: computeEvidence(signals),
      modelEvidence: r.evidence,
      signals,
      technical,
      lowConfidenceTerms: r.lowConfidenceTerms,
      facets: personal ? r.facets : emptyFacets(),
      creditServiceIds: credits,
      candidateSubtags: personal ? r.candidateSubtags : [],
      // No fallback to the raw claim text (it is not redacted): an empty summary means no proposal.
      evidenceSummary: redactCardText(r.evidenceSummary.trim()).slice(0, 400).trim(),
    };
  });
  return {
    rubricVersion: ctx.rubricVersion,
    claims,
    adjacentServices: raw.adjacentServices,
    searchTerms: raw.searchTerms,
    interviewQuality: {
      minutes: Math.round(ctx.elapsedSeconds / 60),
      claimsProbed: claims.filter((c) => c.probed).length,
      endedEarly: !ctx.wrapUpDone,
    },
  };
}

// ---- outputs derived from a scoring

const RANK: Record<EvidenceLevel, number> = { E3: 3, E2: 2, E1: 1, E0: 0, EX: 0, NP: 0 };

export interface ServiceProposal {
  serviceId: string;
  claimId: string;
  role: number;
  evidence: EvidenceLevel;
  recencyYear: number | null;
  summary: string;
  facets: Record<FacetKind, string[]>;
}

/**
 * One proposal per credited service, from the strongest eligible claim. A claim is eligible only when
 * it was probed, shows a personal role (R2+), lands at E1–E3 with at least one quote-verified
 * `supports` signal, has a non-empty (redacted) summary, and raised no review flag — spec §7.2: a
 * flag's only automatic effect is that the claim gets no sub-tags.
 */
export function buildProposals(result: InterviewScoringResultDto, flags: FlagDraft[]): ServiceProposal[] {
  const flagged = new Set(flags.map((f) => f.claimId));
  const best = new Map<string, InterviewClaimScoreDto>();
  for (const c of result.claims) {
    if (!c.probed || (c.role ?? 0) < 2 || RANK[c.evidence] === 0) continue;
    if (flagged.has(c.claimId) || !c.evidenceSummary.trim()) continue;
    if (!SIGNAL_NAMES.some((n) => c.signals[n].rating === 'supports')) continue;
    for (const serviceId of c.creditServiceIds) {
      const cur = best.get(serviceId);
      const better =
        !cur ||
        (c.role ?? 0) > (cur.role ?? 0) ||
        ((c.role ?? 0) === (cur.role ?? 0) && RANK[c.evidence] > RANK[cur.evidence]);
      if (better) best.set(serviceId, c);
    }
  }
  return [...best.entries()].map(([serviceId, c]) => ({
    serviceId,
    claimId: c.claimId,
    role: c.role ?? 0,
    evidence: c.evidence,
    recencyYear: c.facets.recencyYear,
    summary: c.evidenceSummary,
    facets: Object.fromEntries(FACET_KINDS.map((k) => [k, c.facets[k]])) as Record<FacetKind, string[]>,
  }));
}

export interface FlagDraft {
  claimId: string;
  claimText: string;
  serviceIds: string[];
  reason: ReviewFlagReason;
  evidence: InterviewFlagEvidenceDto[];
}

export function buildFlags(
  result: InterviewScoringResultDto,
  selectedServiceIds: Set<string>,
  anchoredServiceIds: Set<string>
): FlagDraft[] {
  const out: FlagDraft[] = [];
  for (const c of result.claims) {
    if (!c.probed) continue;
    const weak = SIGNAL_NAMES.filter((n) => c.signals[n].rating === 'weakens').map((n) => ({
      label: n,
      turn: c.signals[n].turn,
      quote: c.signals[n].quote,
    }));
    const flag = (reason: ReviewFlagReason, evidence: InterviewFlagEvidenceDto[]) =>
      out.push({ claimId: c.claimId, claimText: c.claimText, serviceIds: c.serviceIds, reason, evidence });
    if (c.evidence === 'E0') flag('unsupported', weak);
    if (c.evidence === 'EX') flag('contradicted', weak);
    const conflicts = c.technical.filter((t) => t.kind === 'anchor_conflict');
    if (conflicts.length)
      flag(
        'anchor_conflict',
        conflicts.map((t) => ({ label: t.kind, turn: t.turn, quote: t.quote }))
      );
    // A null role means the scorer could not tell — unknown, not firm-level.
    if (c.role !== null && c.role <= 1 && c.serviceIds.some((id) => selectedServiceIds.has(id)))
      flag('firm_level_on_selected', [{ label: `role R${c.role}`, turn: null, quote: null }, ...weak]);
    const unverified = c.technical.filter((t) => t.kind === 'technical_unverified');
    if (unverified.length && c.serviceIds.some((id) => anchoredServiceIds.has(id)))
      flag(
        'technical_unverified',
        unverified.map((t) => ({ label: t.kind, turn: t.turn, quote: t.quote }))
      );
  }
  return out;
}

export function isVerified(result: InterviewScoringResultDto): boolean {
  return result.claims.some((c) => c.probed && (c.role ?? 0) >= 2 && (c.evidence === 'E2' || c.evidence === 'E3'));
}
