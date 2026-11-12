import { Injectable } from '@nestjs/common';
import type { InterviewScoringResultDto } from '@shared/interview';
import { FACET_KINDS, type FacetKind } from '@shared/subtags';
import { CLOSED_FACETS, matchFacetValue, type FacetValueRow } from './brain/normaliser';
import { RUBRIC_VERSION, Scorer } from './brain/scorer';
import { buildFlags, buildProposals, isVerified } from './brain/scoring';
import { linkedIds, resolveLinkGroups } from './brain/service-links';
import { ledgerSchema, parseStateV2, planV2Schema, type MemberContext, type TranscriptTurn } from './brain/types';
import { InterviewResultsRepository } from './interview-results.repository';
import { InterviewsRepository, type InterviewRow } from './interviews.repository';

/** Score → store → normalise facets → service proposals → review flags (spec §7, steps 1–3). */
@Injectable()
export class InterviewScoringService {
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
    if (opts.reuseCurrent) {
      const current = await this.results.findCurrentScoring(interview.id);
      if (current) return { scoringId: current.id, result: current.result, verified: isVerified(current.result) };
    }
    const ledger = ledgerSchema.parse(interview.ledger);
    const plan = planV2Schema.parse(interview.plan);
    const selected = new Set(member.services.map((s) => s.serviceId));
    const groups = resolveLinkGroups(await this.repo.loadTaxonomy());
    const allowed = linkedIds([...selected], groups);
    const probedServiceIds = ledger.claims.filter((c) => plan.claimIds.includes(c.id)).flatMap((c) => c.serviceIds);
    const [anchors, serviceNames] = await Promise.all([
      this.results.listAnchorEntries(probedServiceIds),
      this.results.serviceNames([...allowed]),
    ]);
    const anchored = new Set(anchors.map((a) => a.serviceId));

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

    const vocabulary = await this.results.listFacetValues();
    for (const p of buildProposals(result)) {
      const facetValueIds = await this.resolveFacets(member.memberId, p.facets, vocabulary);
      await this.results.upsertProposal({
        memberId: member.memberId,
        serviceId: p.serviceId,
        interviewId: interview.id,
        scoringId,
        role: p.role,
        evidence: p.evidence,
        recencyYear: p.recencyYear,
        summary: p.summary,
        facetValueIds,
      });
    }
    await this.results.insertFlags(
      buildFlags(result, selected, anchored).map((f) => ({
        ...f,
        interviewId: interview.id,
        memberId: member.memberId,
        scoringId,
      }))
    );
    return { scoringId, result, verified: isVerified(result) };
  }

  /** Canonical matches are attached; open-facet misses become candidates (never attached). */
  private async resolveFacets(
    memberId: string,
    facets: Record<FacetKind, string[]>,
    vocabulary: FacetValueRow[]
  ): Promise<string[]> {
    const ids = new Set<string>();
    for (const facet of FACET_KINDS) {
      const values = vocabulary.filter((v) => v.facet === facet);
      for (const raw of facets[facet]) {
        const hit = matchFacetValue(raw, values);
        if (hit) {
          if (hit.status === 'canonical') ids.add(hit.id);
          await this.results.addFacetSource(hit.id, memberId);
          continue;
        }
        if (CLOSED_FACETS.has(facet)) continue;
        const candidate = await this.results.upsertCandidate(facet, raw);
        vocabulary.push(candidate);
        await this.results.addFacetSource(candidate.id, memberId);
      }
    }
    return [...ids];
  }
}
