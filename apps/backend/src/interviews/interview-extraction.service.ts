import { Injectable, Logger } from '@nestjs/common';
import { sniffFileType } from '../common/sniff-file-type';
import { EmailService } from '../email/email.service';
import type { Json } from '../supabase/database.types';
import { Drafter } from './brain/drafter';
import type { TranscriptTurn } from './brain/types';
import { ElevenLabsClient } from './elevenlabs.client';
import { InterviewScoringService } from './interview-scoring.service';
import { InterviewsRepository, type ConnectionRow, type InterviewRow } from './interviews.repository';

const CLAIM_STALE_MS = 10 * 60_000;
const TRANSCRIPT_WAIT_MS = 2 * 3600_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class InterviewExtractionService {
  private readonly logger = new Logger(InterviewExtractionService.name);
  constructor(
    private readonly repo: InterviewsRepository,
    private readonly scoring: InterviewScoringService,
    private readonly drafter: Drafter,
    private readonly email: EmailService,
    private readonly elevenLabs: ElevenLabsClient
  ) {}

  async run(shouldStop: () => boolean): Promise<void> {
    const now = Date.now();
    for (const expired of await this.repo.listExpiredInterruptions(new Date(now).toISOString(), 20)) {
      await this.repo.updateInterview(expired.id, {
        status: 'processing',
        endedAt: new Date(now).toISOString(),
        reconnectUntil: null,
      });
    }
    const claimed = await this.repo.claimForExtraction(new Date(now - CLAIM_STALE_MS).toISOString(), 3);
    for (const row of claimed) {
      if (shouldStop()) return;
      try {
        const connections = await this.repo.listConnections(row.id);
        const waiting = connections.some(
          (c) => !c.transcriptReceivedAt && !c.endedAt && now - Date.parse(c.startedAt) < TRANSCRIPT_WAIT_MS
        );
        if (waiting) {
          await this.repo.updateInterview(row.id, { extractClaimedAt: null, extractAttempts: row.extractAttempts - 1 });
          continue;
        }
        // Runs on every claimed attempt once transcripts are in, regardless of outcome below —
        // a non-opted-in member's recording must not survive a failed/retried extraction either.
        await this.handleAudio(row, connections);
        const transcript = connections.flatMap((c) =>
          Array.isArray(c.transcript) ? (c.transcript as TranscriptTurn[]) : []
        );
        if (!transcript.some((t) => t.role === 'user')) {
          await this.repo.updateInterview(row.id, { status: 'failed', failureReason: 'no_transcript' });
          continue;
        }
        const member = await this.repo.loadMemberContext(row.memberId);
        if (!member || !row.plan || !row.ledger) {
          await this.repo.updateInterview(row.id, {
            status: 'failed',
            failureReason: member ? 'no_plan' : 'member_inactive',
          });
          continue;
        }
        // A retry after the scoring was stored reuses it (no duplicate scorings or flags).
        const scored = await this.scoring.scoreAndStore(row, transcript, member, { reuseCurrent: true });
        const { drafts, summary } = await this.drafter.draft({
          transcript,
          member,
          scoring: scored.result,
          onUsage: (u) => void this.repo.addLlmUsage(row.id, 'drafter', u).catch(() => undefined),
        });
        await this.repo.updateInterview(row.id, {
          status: 'completed',
          drafts: drafts as unknown as Json,
          summary,
          summaryStatus: 'pending',
          verifiedAt: scored.verified ? new Date().toISOString() : null,
          failureReason: null,
        });
        const workEmail = await this.repo.findMemberWorkEmail(row.memberId);
        await this.email.enqueueAutomation(
          'interview_drafts_ready',
          { profileId: row.memberId, workEmail },
          { idempotencyKey: `interview_drafts_ready:${row.id}` }
        );
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Extraction failed for ${row.id} (attempt ${row.extractAttempts}): ${message}`);
        if (row.extractAttempts >= MAX_ATTEMPTS)
          await this.repo.updateInterview(row.id, {
            status: 'failed',
            failureReason: `extraction_error: ${message.slice(0, 300)}`,
          });
      }
    }
  }

  /**
   * Runs on every claimed attempt once transcripts are in, regardless of outcome (no_transcript,
   * no_plan, member_inactive, exhausted retries, or a successful completion) — a non-opted-in
   * member's recording must not survive a failed or retried extraction (spec §2: audio deleted
   * unless opted in). Opted-in members: copy each recording into the private bucket, then delete
   * the ElevenLabs copy. Everyone else: delete the ElevenLabs copy without archiving. An opted-in
   * recording that could not be archived yet is left at ElevenLabs. Idempotent across retries
   * (already-archived connections skip archiving; a repeated DELETE is harmless). Best effort:
   * never blocks completion.
   */
  private async handleAudio(row: InterviewRow, connections: ConnectionRow[]): Promise<void> {
    for (const c of connections) {
      if (!c.elevenlabsConversationId) continue;
      let archived = c.audioPath !== null;
      if (row.audioOptIn && !archived) archived = await this.archive(c);
      if (!row.audioOptIn || archived) await this.elevenLabs.deleteConversation(c.elevenlabsConversationId);
    }
  }

  private async archive(c: ConnectionRow): Promise<boolean> {
    try {
      const audio = await this.elevenLabs.conversationAudio(c.elevenlabsConversationId as string);
      if (!audio) return false;
      const kind = await sniffFileType(audio);
      if (kind?.mime !== 'audio/mpeg') {
        this.logger.warn(`Audio for connection ${c.id} is ${kind?.mime ?? 'unknown'}, not mp3; not stored.`);
        return false;
      }
      const path = `${c.interviewId}/${c.id}.mp3`;
      await this.repo.uploadAudio(path, audio);
      await this.repo.updateConnection(c.id, { audioPath: path, audioReceivedAt: new Date().toISOString() });
      return true;
    } catch (error: unknown) {
      this.logger.warn(
        `Audio archive failed for connection ${c.id}: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  }
}
