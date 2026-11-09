import { Injectable, Logger } from '@nestjs/common';
import { sniffFileType } from '../common/sniff-file-type';
import { EmailService } from '../email/email.service';
import type { Json } from '../supabase/database.types';
import { Extractor } from './brain/extractor';
import { parseState, storedPlanSchema, type TranscriptTurn } from './brain/types';
import { ElevenLabsClient } from './elevenlabs.client';
import { InterviewsRepository, type ConnectionRow } from './interviews.repository';

const CLAIM_STALE_MS = 10 * 60_000;
const TRANSCRIPT_WAIT_MS = 2 * 3600_000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class InterviewExtractionService {
  private readonly logger = new Logger(InterviewExtractionService.name);
  constructor(
    private readonly repo: InterviewsRepository,
    private readonly extractor: Extractor,
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
          (c) => !c.transcriptReceivedAt && now - Date.parse(c.startedAt) < TRANSCRIPT_WAIT_MS
        );
        if (waiting) {
          await this.repo.updateInterview(row.id, { extractClaimedAt: null, extractAttempts: row.extractAttempts - 1 });
          continue;
        }
        await this.archiveAudio(connections);
        const transcript = connections.flatMap((c) =>
          Array.isArray(c.transcript) ? (c.transcript as TranscriptTurn[]) : []
        );
        if (!transcript.some((t) => t.role === 'user')) {
          await this.repo.updateInterview(row.id, { status: 'failed', failureReason: 'no_transcript' });
          continue;
        }
        const member = await this.repo.loadMemberContext(row.memberId);
        if (!member || !row.plan) {
          await this.repo.updateInterview(row.id, {
            status: 'failed',
            failureReason: member ? 'no_plan' : 'member_inactive',
          });
          continue;
        }
        const result = await this.extractor.extract({
          plan: storedPlanSchema.parse(row.plan),
          state: parseState(row.state),
          transcript,
          member,
        });
        await this.repo.updateInterview(row.id, {
          status: 'completed',
          drafts: result.drafts as unknown as Json,
          assessment: result.assessment as unknown as Json,
          summary: result.summary,
          summaryStatus: 'pending',
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
   * Copies each finished connection's recording from ElevenLabs into the private interview-audio
   * bucket. Best effort: a missing or non-MP3 recording is logged and never blocks extraction.
   */
  private async archiveAudio(connections: ConnectionRow[]): Promise<void> {
    for (const c of connections) {
      if (!c.elevenlabsConversationId || c.audioPath) continue;
      try {
        const audio = await this.elevenLabs.conversationAudio(c.elevenlabsConversationId);
        if (!audio) continue;
        const kind = await sniffFileType(audio);
        if (kind?.mime !== 'audio/mpeg') {
          this.logger.warn(`Audio for connection ${c.id} is ${kind?.mime ?? 'unknown'}, not mp3; not stored.`);
          continue;
        }
        const path = `${c.interviewId}/${c.id}.mp3`;
        await this.repo.uploadAudio(path, audio);
        await this.repo.updateConnection(c.id, { audioPath: path, audioReceivedAt: new Date().toISOString() });
      } catch (error: unknown) {
        this.logger.warn(
          `Audio archive failed for connection ${c.id}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }
}
