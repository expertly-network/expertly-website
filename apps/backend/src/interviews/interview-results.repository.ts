import { BadRequestException, Injectable } from '@nestjs/common';
import type { InterviewReviewFlagDto, InterviewScoringResultDto } from '@shared/interview';
import type {
  AnchorEntryDto,
  FacetKind,
  InterviewProposedServiceDto,
  MemberSubtagEditItem,
  SubtagStatus,
} from '@shared/subtags';
import { SupabaseService } from '../auth/supabase.service';
import type { Json } from '../supabase/database.types';
import { slugify, type FacetValueRow } from './brain/normaliser';
import type { FlagDraft } from './brain/scoring';
import { dbError } from './interviews.repository';

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
const FLAG_COLUMNS = [
  'id',
  'interviewId:interview_id',
  'memberId:member_id',
  'claimId:claim_id',
  'claimText:claim_text',
  'serviceIds:service_ids',
  'reason',
  'evidence',
  'status',
  'resolutionNote:resolution_note',
  'resolvedAt:resolved_at',
  'createdAt:created_at',
].join(', ');

/** v2 interview outputs: scorings, facet vocabulary, service evidence/sub-tags, flags, anchors. */
@Injectable()
export class InterviewResultsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.db;
  }

  /**
   * Three statements, not a transaction (Supabase-js has no cross-statement transaction here):
   * (1) insert the new row as not-current so a failed insert never touches existing rows,
   * (2) clear every other row for this interview, (3) mark the new row current. If (2) or (3)
   * never runs, `findCurrentScoring`'s "newest row" fallback still returns this row's `result`,
   * since the data itself is already correct after step (1).
   */
  async insertScoring(
    interviewId: string,
    rubricVersion: string,
    model: string,
    result: InterviewScoringResultDto
  ): Promise<string> {
    const { data: inserted, error: insertError } = await this.db
      .from('interview_scorings')
      .insert({
        interview_id: interviewId,
        rubric_version: rubricVersion,
        model,
        // `result` is typed NonNullable<Json> (required) by the generated types; the DTO is a
        // plain object tree, not a Json union member by structural type, so it goes via unknown.
        result: result as unknown as NonNullable<Json>,
        is_current: false,
      })
      .select('id')
      .single();
    if (insertError) throw dbError(`scoring insert failed: ${insertError.message}`);
    const newId = inserted.id;
    const off = await this.db
      .from('interview_scorings')
      .update({ is_current: false })
      .eq('interview_id', interviewId)
      .neq('id', newId);
    if (off.error) throw dbError(`scoring update failed: ${off.error.message}`);
    const current = await this.db.from('interview_scorings').update({ is_current: true }).eq('id', newId);
    if (current.error) throw dbError(`scoring update failed: ${current.error.message}`);
    return newId;
  }

  async findCurrentScoring(interviewId: string): Promise<{ id: string; result: InterviewScoringResultDto } | null> {
    const { data, error } = await this.db
      .from('interview_scorings')
      .select('id, result')
      .eq('interview_id', interviewId)
      .eq('is_current', true)
      .maybeSingle();
    if (error) throw dbError(`scoring read failed: ${error.message}`);
    if (data) return { id: data.id, result: data.result as unknown as InterviewScoringResultDto };
    // No row is flagged current (e.g. insertScoring's step 2/3 above never completed) — fall
    // back to the newest row for this interview, which always holds a correct `result`.
    const { data: latest, error: latestError } = await this.db
      .from('interview_scorings')
      .select('id, result')
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw dbError(`scoring read failed: ${latestError.message}`);
    return latest ? { id: latest.id, result: latest.result as unknown as InterviewScoringResultDto } : null;
  }

  async listFacetValues(): Promise<FacetValueRow[]> {
    const { data, error } = await this.db.from('facet_values').select(FACET_COLUMNS).neq('status', 'rejected');
    if (error) throw dbError(`facet values read failed: ${error.message}`);
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
    if (ins.error) throw dbError(`facet candidate insert failed: ${ins.error.message}`);
    const { data, error } = await this.db
      .from('facet_values')
      .select(FACET_COLUMNS)
      .eq('facet', facet)
      .eq('slug', slug)
      .single();
    if (error) throw dbError(`facet candidate read failed: ${error.message}`);
    return data as unknown as FacetValueRow;
  }

  async addFacetSource(facetValueId: string, memberId: string): Promise<void> {
    const { error } = await this.db.rpc('facet_value_add_source', {
      p_facet_value_id: facetValueId,
      p_member_id: memberId,
    });
    if (error) throw dbError(`facet source failed: ${error.message}`);
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
    if (error) throw dbError(`proposal upsert failed: ${error.message}`);
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
    if (error) throw dbError(`flags insert failed: ${error.message}`);
  }

  async listAnchorEntries(serviceIds: string[]): Promise<AnchorEntryDto[]> {
    if (!serviceIds.length) return [];
    const { data, error } = await this.db
      .from('service_anchor_entries')
      .select(
        'id, serviceId:service_id, deliverables, instruments, tools, practitionerDetail:practitioner_detail, bluffAnswer:bluff_answer'
      )
      .in('service_id', [...new Set(serviceIds)]);
    if (error) throw dbError(`anchor entries read failed: ${error.message}`);
    return (data ?? []) as unknown as AnchorEntryDto[];
  }

  async serviceNames(serviceIds: string[]): Promise<Map<string, string>> {
    if (!serviceIds.length) return new Map();
    const { data, error } = await this.db
      .from('services')
      .select('id, name')
      .in('id', [...new Set(serviceIds)]);
    if (error) throw dbError(`services read failed: ${error.message}`);
    return new Map((data ?? []).map((s) => [s.id, s.name.trim().replace(/[.:;,\s]+$/u, '')]));
  }

  async listProposals(memberId: string, interviewId: string): Promise<InterviewProposedServiceDto[]> {
    const [evidenceRes, subtagRes] = await Promise.all([
      this.db
        .from('member_service_evidence')
        .select('service_id, evidence_summary, status, services!inner(name, categories!inner(name))')
        .eq('member_id', memberId)
        .eq('interview_id', interviewId),
      this.db
        .from('member_service_subtags')
        .select('service_id, status, facet_values!inner(id, facet, label)')
        .eq('member_id', memberId),
    ]);
    if (evidenceRes.error) throw dbError(`evidence read failed: ${evidenceRes.error.message}`);
    if (subtagRes.error) throw dbError(`subtags read failed: ${subtagRes.error.message}`);
    type One<T> = T | T[];
    const one = <T>(v: One<T>): T => (Array.isArray(v) ? v[0] : v);
    const subtags = (subtagRes.data ?? []) as unknown as {
      service_id: string;
      status: SubtagStatus;
      facet_values: One<{ id: string; facet: FacetKind; label: string }>;
    }[];
    return (
      (evidenceRes.data ?? []) as unknown as {
        service_id: string;
        evidence_summary: string;
        status: SubtagStatus;
        services: One<{ name: string; categories: One<{ name: string }> }>;
      }[]
    ).map((e) => {
      const svc = one(e.services);
      return {
        serviceId: e.service_id,
        serviceName: svc.name.trim().replace(/[.:;,\s]+$/u, ''),
        categoryName: one(svc.categories).name,
        evidenceSummary: e.evidence_summary,
        status: e.status,
        subtags: subtags
          .filter((s) => s.service_id === e.service_id && s.status !== 'rejected')
          .map((s) => {
            const fv = one(s.facet_values);
            return { facetValueId: fv.id, facet: fv.facet, label: fv.label };
          }),
      };
    });
  }

  /**
   * The member's review: remove sub-tags, optionally rewrite summaries, then approve the whole
   * proposal. Ordering matters for safe retries: (a) validate every edit against the proposed set
   * BEFORE any write, so a bad edit never leaves an earlier valid edit half-applied; (b) apply the
   * per-service deletes/summary rewrites; (c) flip sub-tags to member_approved; (d) flip evidence
   * to member_approved LAST. If the process dies between (c) and (d), evidence is still `proposed`,
   * so a retry re-reads the same proposed set in step (a) and finishes the job — it never leaves
   * evidence proposed with no way to recover.
   */
  async memberApprove(memberId: string, interviewId: string, edits: MemberSubtagEditItem[]): Promise<void> {
    const proposed = await this.db
      .from('member_service_evidence')
      .select('service_id')
      .eq('member_id', memberId)
      .eq('interview_id', interviewId)
      .eq('status', 'proposed');
    if (proposed.error) throw dbError(`evidence read failed: ${proposed.error.message}`);
    const ids = new Set((proposed.data ?? []).map((r) => r.service_id));
    for (const edit of edits) {
      if (!ids.has(edit.serviceId))
        throw new BadRequestException({
          code: 'INTERVIEW_SUBTAGS_NOT_PROPOSED',
          message: 'One of these services has no open proposal.',
        });
    }
    for (const edit of edits) {
      if (edit.removeFacetValueIds.length) {
        const del = await this.db
          .from('member_service_subtags')
          .delete()
          .eq('member_id', memberId)
          .eq('service_id', edit.serviceId)
          .in('facet_value_id', edit.removeFacetValueIds);
        if (del.error) throw dbError(`subtag delete failed: ${del.error.message}`);
      }
      if (edit.evidenceSummary) {
        const upd = await this.db
          .from('member_service_evidence')
          .update({ evidence_summary: edit.evidenceSummary })
          .eq('member_id', memberId)
          .eq('service_id', edit.serviceId);
        if (upd.error) throw dbError(`summary update failed: ${upd.error.message}`);
      }
    }
    if (!ids.size) return;
    const svcIds = [...ids];
    const st = await this.db
      .from('member_service_subtags')
      .update({ status: 'member_approved' })
      .eq('member_id', memberId)
      .in('service_id', svcIds)
      .eq('status', 'proposed');
    if (st.error) throw dbError(`subtags approve failed: ${st.error.message}`);
    const ev = await this.db
      .from('member_service_evidence')
      .update({ status: 'member_approved' })
      .eq('member_id', memberId)
      .in('service_id', svcIds);
    if (ev.error) throw dbError(`evidence approve failed: ${ev.error.message}`);
  }

  async listFlagsForInterview(interviewId: string, memberName: string): Promise<InterviewReviewFlagDto[]> {
    const { data, error } = await this.db
      .from('interview_review_flags')
      .select(FLAG_COLUMNS)
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: true });
    if (error) throw dbError(`flags read failed: ${error.message}`);
    return ((data ?? []) as unknown as Omit<InterviewReviewFlagDto, 'memberName'>[]).map((f) => ({
      ...f,
      memberName,
    }));
  }
}
