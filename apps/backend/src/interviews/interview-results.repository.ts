import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { InterviewScoringResultDto } from '@shared/interview';
import type { AnchorEntryDto, FacetKind } from '@shared/subtags';
import { SupabaseService } from '../auth/supabase.service';
import type { Json } from '../supabase/database.types';
import { slugify, type FacetValueRow } from './brain/normaliser';
import type { FlagDraft } from './brain/scoring';

export interface ProposalInput {
  memberId: string;
  serviceId: string;
  interviewId: string;
  scoringId: string;
  role: number;
  evidence: string;
  recencyYear: number | null;
  summary: string;
  facetValueIds: string[];
}
export interface FlagInsert extends FlagDraft {
  interviewId: string;
  memberId: string;
  scoringId: string;
}

const FACET_COLUMNS = 'id, facet, label, slug, status, aliases, sourceCount:source_count';

export function resultsDbError(message: string): InternalServerErrorException {
  return new InternalServerErrorException({ code: 'INTERVIEW_DB_ERROR', message });
}

/** v2 interview outputs: scorings, facet vocabulary, service evidence/sub-tags, flags, anchors. */
@Injectable()
export class InterviewResultsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.db;
  }

  async insertScoring(
    interviewId: string,
    rubricVersion: string,
    model: string,
    result: InterviewScoringResultDto
  ): Promise<string> {
    const off = await this.db.from('interview_scorings').update({ is_current: false }).eq('interview_id', interviewId);
    if (off.error) throw resultsDbError(`scoring update failed: ${off.error.message}`);
    const { data, error } = await this.db
      .from('interview_scorings')
      .insert({
        interview_id: interviewId,
        rubric_version: rubricVersion,
        model,
        // `result` is typed NonNullable<Json> (required) by the generated types; the DTO is a
        // plain object tree, not a Json union member by structural type, so it goes via unknown.
        result: result as unknown as NonNullable<Json>,
        is_current: true,
      })
      .select('id')
      .single();
    if (error) throw resultsDbError(`scoring insert failed: ${error.message}`);
    return data.id;
  }

  async findCurrentScoring(interviewId: string): Promise<{ id: string; result: InterviewScoringResultDto } | null> {
    const { data, error } = await this.db
      .from('interview_scorings')
      .select('id, result')
      .eq('interview_id', interviewId)
      .eq('is_current', true)
      .maybeSingle();
    if (error) throw resultsDbError(`scoring read failed: ${error.message}`);
    return data ? { id: data.id, result: data.result as unknown as InterviewScoringResultDto } : null;
  }

  async listFacetValues(): Promise<FacetValueRow[]> {
    const { data, error } = await this.db.from('facet_values').select(FACET_COLUMNS).neq('status', 'rejected');
    if (error) throw resultsDbError(`facet values read failed: ${error.message}`);
    return (data ?? []) as unknown as FacetValueRow[];
  }

  /** Inserts a candidate (or returns the existing row with that slug). */
  async upsertCandidate(facet: FacetKind, label: string): Promise<FacetValueRow> {
    const slug = slugify(label);
    const ins = await this.db.from('facet_values').upsert(
      { facet, label: label.trim().slice(0, 120), slug, status: 'candidate' },
      {
        onConflict: 'facet,slug',
        ignoreDuplicates: true,
      }
    );
    if (ins.error) throw resultsDbError(`facet candidate insert failed: ${ins.error.message}`);
    const { data, error } = await this.db
      .from('facet_values')
      .select(FACET_COLUMNS)
      .eq('facet', facet)
      .eq('slug', slug)
      .single();
    if (error) throw resultsDbError(`facet candidate read failed: ${error.message}`);
    return data as unknown as FacetValueRow;
  }

  async addFacetSource(facetValueId: string, memberId: string): Promise<void> {
    const { error } = await this.db.rpc('facet_value_add_source', {
      p_facet_value_id: facetValueId,
      p_member_id: memberId,
    });
    if (error) throw resultsDbError(`facet source failed: ${error.message}`);
  }

  /** False when the member already approved, or an admin activated, this service's proposal. */
  async upsertProposal(p: ProposalInput): Promise<boolean> {
    const { data, error } = await this.db.rpc('interview_upsert_service_proposal', {
      p_member_id: p.memberId,
      p_service_id: p.serviceId,
      p_interview_id: p.interviewId,
      p_scoring_id: p.scoringId,
      p_role: p.role,
      p_evidence: p.evidence,
      // The generated Args type has p_recency_year as a non-nullable `number` (codegen doesn't
      // mark a defaultless-but-nullable-column int4 arg as nullable); the SQL function itself
      // accepts NULL (no NOT NULL on that param), so this narrows the compile-time type only.
      p_recency_year: p.recencyYear as number,
      p_summary: p.summary,
      p_facet_value_ids: p.facetValueIds,
    });
    if (error) throw resultsDbError(`proposal upsert failed: ${error.message}`);
    return data === true;
  }

  async insertFlags(rows: FlagInsert[]): Promise<void> {
    if (!rows.length) return;
    const { error } = await this.db.from('interview_review_flags').upsert(
      rows.map((r) => ({
        interview_id: r.interviewId,
        member_id: r.memberId,
        scoring_id: r.scoringId,
        claim_id: r.claimId,
        claim_text: r.claimText,
        service_ids: r.serviceIds,
        reason: r.reason,
        // See insertScoring: evidence is typed NonNullable<Json> on the Insert side too.
        evidence: r.evidence as unknown as NonNullable<Json>,
      })),
      { onConflict: 'scoring_id,claim_id,reason', ignoreDuplicates: true }
    );
    if (error) throw resultsDbError(`flags insert failed: ${error.message}`);
  }

  async listAnchorEntries(serviceIds: string[]): Promise<AnchorEntryDto[]> {
    if (!serviceIds.length) return [];
    const { data, error } = await this.db
      .from('service_anchor_entries')
      .select(
        'id, serviceId:service_id, deliverables, instruments, tools, practitionerDetail:practitioner_detail, bluffAnswer:bluff_answer'
      )
      .in('service_id', [...new Set(serviceIds)]);
    if (error) throw resultsDbError(`anchor entries read failed: ${error.message}`);
    return (data ?? []) as unknown as AnchorEntryDto[];
  }

  async serviceNames(serviceIds: string[]): Promise<Map<string, string>> {
    if (!serviceIds.length) return new Map();
    const { data, error } = await this.db
      .from('services')
      .select('id, name')
      .in('id', [...new Set(serviceIds)]);
    if (error) throw resultsDbError(`services read failed: ${error.message}`);
    return new Map((data ?? []).map((s) => [s.id, s.name.trim().replace(/[.:;,\s]+$/u, '')]));
  }
}
