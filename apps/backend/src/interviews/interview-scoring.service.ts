import { ConflictException, Injectable, Logger } from '@nestjs/common';
import type { InterviewScoringResultDto } from '@shared/interview';
import { FACET_KINDS, type FacetKind } from '@shared/subtags';
import { CLOSED_FACETS, matchFacetValue, slugify, type FacetValueRow } from './brain/normaliser';
import { RUBRIC_VERSION, Scorer } from './brain/scorer';
import { buildFlags, buildProposals, isVerified } from './brain/scoring';
import { linkedIds, resolveLinkGroups } from './brain/service-links';
import { ledgerSchema, parseStateV2, planV2Schema, type MemberContext, type TranscriptTurn } from './brain/types';
import { InterviewResultsRepository } from './interview-results.repository';
import { InterviewsRepository, type InterviewRow } from './interviews.repository';

/** Score → store → normalise facets → service proposals → review flags (spec §7, steps 1–3). */
@Injectable()
export class InterviewScoringService {
  private readonly logger = new Logger(InterviewScoringService.name);

  constructor(
    private readonly scorer: Scorer,
    private readonly results: InterviewResultsRepository,
    private readonly repo: InterviewsRepository
  ) {}

  async scoreAndStore(
    interview: InterviewRow,
    transcript: TranscriptTurn[],
    member: MemberContext,
    opts: { reuseCurrent?: boolean } = {}
  ): Promise<{ scoringId: string; result: InterviewScoringResultDto; verified: boolean }> {
    if (!interview.ledger || !interview.plan)
      throw new ConflictException({
        code: 'INTERVIEW_NOT_V2',
        message: 'This interview predates claim ledgers and cannot be scored.',
      });
    const ledger = ledgerSchema.parse(interview.ledger);
    const plan = planV2Schema.parse(interview.plan);
    const selected = new Set(member.services.map((s) => s.serviceId));
    const groups = resolveLinkGroups(await this.repo.loadTaxonomy());
    const allowed = linkedIds([...selected], groups);
    const probedServiceIds = ledger.claims.filter((c) => plan.claimIds.includes(c.id)).flatMap((c) => c.serviceIds);
    // Anchors (and the anchored-service set derived from them) feed both the scorer prompt and
    // buildFlags below, so they're loaded once regardless of which branch produces the scoring.
    const anchors = await this.results.listAnchorEntries(probedServiceIds);
    const anchored = new Set(anchors.map((a) => a.serviceId));

    const current = opts.reuseCurrent ? await this.results.findCurrentScoring(interview.id) : null;
    const { scoringId, result } = current
      ? { scoringId: current.id, result: current.result }
      : await this.score(interview, transcript, ledger, plan, allowed, anchored, anchors);

    // Always run the downstream writes, even when reusing a stored scoring: an earlier attempt
    // may have stored the scoring and then failed before proposals/flags landed. Both writes are
    // idempotent (upsertProposal skips approved/activated rows, insertFlags ignores duplicates on
    // scoring_id+claim_id+reason), so re-running them on a retry is safe.
    await this.storeOutputs(interview.id, scoringId, result, member, selected, anchored);

    return { scoringId, result, verified: isVerified(result) };
  }

  /** Calls the scorer model and stores the new scoring row. */
  private async score(
    interview: InterviewRow,
    transcript: TranscriptTurn[],
    ledger: ReturnType<typeof ledgerSchema.parse>,
    plan: ReturnType<typeof planV2Schema.parse>,
    allowed: Set<string>,
    anchored: Set<string>,
    anchors: Awaited<ReturnType<InterviewResultsRepository['listAnchorEntries']>>
  ): Promise<{ scoringId: string; result: InterviewScoringResultDto }> {
    const serviceNames = await this.results.serviceNames([...allowed]);
    const { result, model } = await this.scorer.score(
      {
        ledger,
        plan,
        transcript,
        allowedServiceIds: allowed,
        anchoredServiceIds: anchored,
        elapsedSeconds: interview.elapsedSeconds,
        wrapUpDone: parseStateV2(interview.state).wrapUpDone,
        anchors,
        serviceNames,
      },
      (u) => void this.repo.addLlmUsage(interview.id, 'scorer', u).catch(() => undefined)
    );
    const scoringId = await this.results.insertScoring(interview.id, RUBRIC_VERSION, model, result);
    return { scoringId, result };
  }

  /** Proposals + review flags for a scoring (fresh or reused) — idempotent, safe to re-run. */
  private async storeOutputs(
    interviewId: string,
    scoringId: string,
    result: InterviewScoringResultDto,
    member: MemberContext,
    selected: Set<string>,
    anchored: Set<string>
  ): Promise<void> {
    const vocabulary = await this.results.listFacetValues();
    // Flags first: a flagged claim never becomes a proposal (spec §7.2).
    const flags = buildFlags(result, selected, anchored);
    for (const p of buildProposals(result, flags)) {
      const facetValueIds = await this.resolveFacets(member.memberId, p.facets, vocabulary);
      await this.results.upsertProposal({
        memberId: member.memberId,
        serviceId: p.serviceId,
        interviewId,
        scoringId,
        role: p.role,
        evidence: p.evidence,
        recencyYear: p.recencyYear,
        summary: p.summary,
        facetValueIds,
      });
    }
    await this.results.insertFlags(
      flags.map((f) => ({
        ...f,
        interviewId,
        memberId: member.memberId,
        scoringId,
      }))
    );
  }

  /**
   * Canonical matches are attached; open-facet misses become candidates (never attached). One bad
   * value (unsluggable text, a DB error on its candidate/source write) is logged and skipped — it
   * must never fail the whole interview's scoring.
   */
  private async resolveFacets(
    memberId: string,
    facets: Record<FacetKind, string[]>,
    vocabulary: FacetValueRow[]
  ): Promise<string[]> {
    const ids = new Set<string>();
    for (const facet of FACET_KINDS) {
      const values = vocabulary.filter((v) => v.facet === facet);
      for (const raw of facets[facet]) {
        try {
          const hit = matchFacetValue(raw, values);
          if (hit) {
            if (hit.status === 'canonical') ids.add(hit.id);
            await this.results.addFacetSource(hit.id, memberId);
            continue;
          }
          // Unsluggable text (only punctuation/non-Latin) would violate facet_values' slug check.
          if (CLOSED_FACETS.has(facet) || !slugify(raw)) continue;
          const candidate = await this.results.upsertCandidate(facet, raw);
          vocabulary.push(candidate);
          await this.results.addFacetSource(candidate.id, memberId);
        } catch (error: unknown) {
          this.logger.warn(`Facet value skipped (${facet}): ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    return [...ids];
  }
}
