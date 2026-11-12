import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { InterviewReviewFlagDto, InterviewScoringResultDto, ReviewFlagStatus } from '@shared/interview';
import type {
  AdminMemberServiceEvidenceDto,
  AdminSubtagDecisionItem,
  AnchorEntryDto,
  FacetKind,
  FacetValueDto,
  FacetValueStatus,
  InterviewProposedServiceDto,
  MemberSubtagEditItem,
  SubtagStatus,
} from '@shared/subtags';
import { SupabaseService } from '../auth/supabase.service';
import type { Database, Json } from '../supabase/database.types';
import { slugify, type FacetValueRow } from './brain/normaliser';
import type { FlagDraft } from './brain/scoring';
import { dbError } from './interviews.repository';

type FacetValueUpdate = Database['public']['Tables']['facet_values']['Update'];

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
// A re-score moves an older scoring's still-open flags to `superseded` (interview_store_scoring(),
// see the migration) — a real status, not a query-side filter, so both listings below are plain
// selects. `listFlags`'s own `status` filter does the hiding (status=open no longer returns
// superseded rows); `listFlagsForInterview` intentionally returns every status, superseded
// included, as that interview's history.
type FlagRow = Omit<InterviewReviewFlagDto, 'memberName'>;

export interface AdminEvidenceInput {
  memberId: string;
  serviceId: string;
  interviewId: string;
  scoringId: string;
  role: number;
  evidence: string;
  recencyYear: number | null;
  summary: string;
}

/** v2 interview outputs: scorings, facet vocabulary, service evidence/sub-tags, flags, anchors. */
@Injectable()
export class InterviewResultsRepository {
  constructor(private readonly supabase: SupabaseService) {}

  private get db() {
    return this.supabase.db;
  }

  /**
   * One transaction (`interview_store_scoring()`, see the migration): clears every other row for
   * this interview, inserts the new one as current, supersedes the interview's still-`open` flags
   * from any other scoring, and deletes its still-`proposed` evidence from any other scoring (what
   * used to be a separate `deleteStaleProposals` call after a re-score). No partial state is
   * observable between those steps, so there is no "no row flagged current" case to fall back
   * from any more — see `findCurrentScoring` below.
   */
  async insertScoring(
    interviewId: string,
    rubricVersion: string,
    model: string,
    result: InterviewScoringResultDto
  ): Promise<string> {
    const { data, error } = await this.db.rpc('interview_store_scoring', {
      p_interview_id: interviewId,
      p_rubric_version: rubricVersion,
      p_model: model,
      // The DTO is a plain object tree, not a Json union member by structural type, so it goes
      // via unknown (same as the direct-insert cast this replaced).
      p_result: result as unknown as Json,
    });
    if (error) throw dbError(`scoring store failed: ${error.message}`);
    return data as string;
  }

  /** The interview's current scoring, or null if it has never been scored. `interview_store_scoring()`
   *  keeps exactly one `is_current` row per interview atomically, so (unlike before this
   *  repository called an RPC for the insert) there is no "no row flagged current" case left to
   *  fall back from — a plain read is both simpler and now provably complete. */
  async findCurrentScoring(interviewId: string): Promise<{ id: string; result: InterviewScoringResultDto } | null> {
    const { data, error } = await this.db
      .from('interview_scorings')
      .select('id, result')
      .eq('interview_id', interviewId)
      .eq('is_current', true)
      .maybeSingle();
    if (error) throw dbError(`scoring read failed: ${error.message}`);
    return data ? { id: data.id, result: data.result as unknown as InterviewScoringResultDto } : null;
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
   * One transaction (`interview_member_approve()`, see the migration): locks and reads the
   * member's `proposed` evidence rows for this interview, validates every edit's serviceId is one
   * of them (raises `INTERVIEW_SUBTAGS_NOT_PROPOSED`, writing nothing, otherwise), applies the
   * per-service sub-tag deletes/summary rewrites, then flips those services' sub-tags and
   * evidence to `member_approved`.
   */
  async memberApprove(memberId: string, interviewId: string, edits: MemberSubtagEditItem[]): Promise<void> {
    const { error } = await this.db.rpc('interview_member_approve', {
      p_member_id: memberId,
      p_interview_id: interviewId,
      p_edits: edits as unknown as Json,
    });
    if (!error) return;
    if (error.message === 'INTERVIEW_SUBTAGS_NOT_PROPOSED')
      throw new BadRequestException({
        code: 'INTERVIEW_SUBTAGS_NOT_PROPOSED',
        message: 'One of these services has no open proposal.',
      });
    throw dbError(`member approve failed: ${error.message}`);
  }

  /** This interview's flags, every status included — a `superseded` one is still this
   *  interview's history, same as a resolved one. */
  async listFlagsForInterview(interviewId: string, memberName: string): Promise<InterviewReviewFlagDto[]> {
    const { data, error } = await this.db
      .from('interview_review_flags')
      .select(FLAG_COLUMNS)
      .eq('interview_id', interviewId)
      .order('created_at', { ascending: true });
    if (error) throw dbError(`flags read failed: ${error.message}`);
    return ((data ?? []) as unknown as FlagRow[]).map((f) => ({ ...f, memberName }));
  }

  async listFlags(input: {
    status?: ReviewFlagStatus;
    offset: number;
    limit: number;
  }): Promise<{ rows: FlagRow[]; total: number }> {
    let q = this.db.from('interview_review_flags').select(FLAG_COLUMNS, { count: 'exact' });
    if (input.status) q = q.eq('status', input.status);
    const { data, error, count } = await q
      .order('created_at', { ascending: false })
      .range(input.offset, input.offset + input.limit - 1);
    if (error) throw dbError(`flags list failed: ${error.message}`);
    const rows = (data ?? []) as unknown as FlagRow[];
    return { rows, total: count ?? rows.length };
  }

  /** Only an `open` flag can be resolved — a flag the queue no longer shows as open (already
   *  resolved, or superseded by a re-score) is `INTERVIEW_FLAG_NOT_OPEN`, distinct from not
   *  existing at all (`INTERVIEW_FLAG_NOT_FOUND`). The second read only runs when the guarded
   *  update affected nothing, so the common case stays one round trip. */
  async resolveFlag(
    id: string,
    status: 'dismissed' | 'confirmed',
    note: string | null,
    adminId: string
  ): Promise<Omit<InterviewReviewFlagDto, 'memberName'>> {
    const { data, error } = await this.db
      .from('interview_review_flags')
      .update({ status, resolution_note: note, resolved_by: adminId, resolved_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'open')
      .select(FLAG_COLUMNS)
      .maybeSingle();
    if (error) throw dbError(`flag update failed: ${error.message}`);
    if (data) return data as unknown as Omit<InterviewReviewFlagDto, 'memberName'>;
    const existing = await this.db.from('interview_review_flags').select('status').eq('id', id).maybeSingle();
    if (existing.error) throw dbError(`flag read failed: ${existing.error.message}`);
    if (!existing.data) throw new NotFoundException({ code: 'INTERVIEW_FLAG_NOT_FOUND', message: 'Flag not found.' });
    throw new ConflictException({
      code: 'INTERVIEW_FLAG_NOT_OPEN',
      message: 'Only an open flag can be resolved.',
    });
  }

  /** Service ids this member has interview evidence for — the validation read decideSubtags
   *  uses to check every requested serviceId before applying any write (same lesson as
   *  memberApprove above: validate the whole batch first, so one bad id never leaves an
   *  earlier valid decision half-applied). */
  async listEvidenceServiceIds(memberId: string): Promise<string[]> {
    const { data, error } = await this.db
      .from('member_service_evidence')
      .select('service_id')
      .eq('member_id', memberId);
    if (error) throw dbError(`evidence read failed: ${error.message}`);
    return (data ?? []).map((r) => r.service_id);
  }

  async listMemberEvidence(memberId: string): Promise<AdminMemberServiceEvidenceDto[]> {
    const { data, error } = await this.db
      .from('member_service_evidence')
      .select('service_id, interview_id, role, evidence, recency_year')
      .eq('member_id', memberId);
    if (error) throw dbError(`evidence read failed: ${error.message}`);
    const rows = (data ?? []) as {
      service_id: string;
      interview_id: string;
      role: number;
      evidence: string;
      recency_year: number | null;
    }[];
    const out: AdminMemberServiceEvidenceDto[] = [];
    for (const interviewId of [...new Set(rows.map((r) => r.interview_id))]) {
      for (const p of await this.listProposals(memberId, interviewId)) {
        const r = rows.find((x) => x.service_id === p.serviceId)!;
        out.push({ ...p, role: r.role, evidence: r.evidence, recencyYear: r.recency_year });
      }
    }
    return out;
  }

  /**
   * One transaction (`interview_admin_decide_subtags()`, see the migration): inserts the
   * TypeScript-resolved seed evidence rows (services the scorer never proposed, seeded `active`
   * from the current scoring's claim — `on conflict do nothing`), verifies every decision's
   * serviceId now has an evidence row for the member (raises `INTERVIEW_EVIDENCE_NOT_FOUND`,
   * writing nothing else, if not), then per decision: evidence status active/rejected, removed
   * sub-tags deleted, remaining sub-tags set to the same status, and (when accepted) any added
   * facet values inserted as `active`.
   */
  async adminDecideSubtags(
    memberId: string,
    decisions: AdminSubtagDecisionItem[],
    seeds: AdminEvidenceInput[]
  ): Promise<void> {
    const { error } = await this.db.rpc('interview_admin_decide_subtags', {
      p_member_id: memberId,
      p_decisions: decisions as unknown as Json,
      p_seed_evidence: seeds.map((s) => ({
        serviceId: s.serviceId,
        interviewId: s.interviewId,
        scoringId: s.scoringId,
        role: s.role,
        evidence: s.evidence,
        recencyYear: s.recencyYear,
        summary: s.summary,
      })) as unknown as Json,
    });
    if (!error) return;
    if (error.message === 'INTERVIEW_EVIDENCE_NOT_FOUND')
      throw new NotFoundException({
        code: 'INTERVIEW_EVIDENCE_NOT_FOUND',
        message: 'No interview evidence for that service.',
      });
    throw dbError(`admin subtag decision failed: ${error.message}`);
  }

  async listFacetValuesAdmin(input: {
    facet?: FacetKind;
    status?: FacetValueStatus;
    offset: number;
    limit: number;
  }): Promise<{ items: FacetValueDto[]; total: number }> {
    let q = this.db.from('facet_values').select(FACET_COLUMNS, { count: 'exact' });
    if (input.facet) q = q.eq('facet', input.facet);
    if (input.status) q = q.eq('status', input.status);
    const { data, error, count } = await q
      .order('source_count', { ascending: false })
      .order('label', { ascending: true })
      .range(input.offset, input.offset + input.limit - 1);
    if (error) throw dbError(`facet values list failed: ${error.message}`);
    const items = (data ?? []) as unknown as FacetValueDto[];
    return { items, total: count ?? items.length };
  }

  async createFacetValue(facet: FacetKind, label: string, aliases: string[]): Promise<FacetValueDto> {
    const slug = slugify(label);
    if (!slug)
      throw new BadRequestException({
        code: 'FACET_VALUE_INVALID',
        message: 'The label needs at least one Latin letter or digit.',
      });
    const { data, error } = await this.db
      .from('facet_values')
      .insert({ facet, label: label.trim(), slug, status: 'canonical', aliases })
      .select(FACET_COLUMNS)
      .single();
    if (error?.code === '23505')
      throw new BadRequestException({ code: 'FACET_VALUE_EXISTS', message: 'That value already exists.' });
    if (error) throw dbError(`facet value insert failed: ${error.message}`);
    return data as unknown as FacetValueDto;
  }

  async updateFacetValue(
    id: string,
    patch: { status?: FacetValueStatus; label?: string; aliases?: string[] }
  ): Promise<FacetValueDto> {
    const update: FacetValueUpdate = {};
    if (patch.status) update.status = patch.status;
    if (patch.label) update.label = patch.label.trim();
    if (patch.aliases) update.aliases = patch.aliases.map((a) => a.trim().toLowerCase()).filter(Boolean);
    const { data, error } = await this.db
      .from('facet_values')
      .update(update)
      .eq('id', id)
      .select(FACET_COLUMNS)
      .maybeSingle();
    if (error) throw dbError(`facet value update failed: ${error.message}`);
    if (!data) throw new NotFoundException({ code: 'FACET_VALUE_NOT_FOUND', message: 'Value not found.' });
    return data as unknown as FacetValueDto;
  }
}
