import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import type { Json } from '../supabase/database.types';
import { parseStateV2, type TranscriptTurn } from './brain/types';
import { InterviewConfig } from './interview.config';
import { InterviewsRepository } from './interviews.repository';
import { hashSessionToken } from './session-token';

const MIN_REMAINING_FOR_RECONNECT = 180;

const transcriptionSchema = z.object({
  type: z.literal('post_call_transcription'),
  data: z.object({
    conversation_id: z.string(),
    transcript: z.array(
      z.object({
        role: z.string(),
        message: z.string().nullable().optional(),
        time_in_call_secs: z.number().nullable().optional(),
      })
    ),
    metadata: z.object({ call_duration_secs: z.number().nonnegative() }).passthrough(),
    conversation_initiation_client_data: z
      .object({ dynamic_variables: z.record(z.string(), z.unknown()).optional() })
      .passthrough()
      .optional(),
  }),
});
@Injectable()
export class InterviewWebhooksService {
  private readonly logger = new Logger(InterviewWebhooksService.name);
  constructor(
    private readonly repo: InterviewsRepository,
    private readonly config: InterviewConfig
  ) {}

  async handle(event: unknown): Promise<void> {
    const type = (event as { type?: unknown } | null)?.type;
    if (type === 'post_call_transcription') return this.transcription(event);
    // Audio is not taken from webhooks (a 30-minute call is ~10–20 MB of base64, far over the API's
    // body limit); the extraction worker downloads it from ElevenLabs instead.
    if (type === 'call_initiation_failure') {
      this.logger.warn(
        `ElevenLabs call initiation failure: ${JSON.stringify((event as { data?: unknown }).data ?? {}).slice(0, 500)}`
      );
    }
  }

  private async transcription(event: unknown): Promise<void> {
    const parsed = transcriptionSchema.safeParse(event);
    if (!parsed.success) {
      this.logger.warn('Unparseable transcription webhook ignored.');
      return;
    }
    const { data } = parsed.data;
    const token = data.conversation_initiation_client_data?.dynamic_variables?.session_token;
    if (typeof token !== 'string') {
      this.logger.warn(`Transcription ${data.conversation_id} has no session_token; ignored.`);
      return;
    }
    const found = await this.repo.findByTokenHash(hashSessionToken(token));
    if (!found) {
      this.logger.warn(`Transcription ${data.conversation_id} matches no connection; ignored.`);
      return;
    }
    const { connection, interview } = found;
    if (connection.transcriptReceivedAt) return; // duplicate delivery

    const now = new Date();
    const transcript: TranscriptTurn[] = data.transcript
      .filter((t) => (t.role === 'agent' || t.role === 'user') && (t.message ?? '').trim())
      .map((t) => ({
        role: t.role as 'agent' | 'user',
        message: (t.message ?? '').trim(),
        timeInCallSecs: t.time_in_call_secs ?? null,
      }));
    const duration = Math.round(data.metadata.call_duration_secs);
    await this.repo.updateConnection(connection.id, {
      elevenlabsConversationId: data.conversation_id,
      transcript: transcript as unknown as Json,
      durationSeconds: duration,
      endedAt: now.toISOString(),
      transcriptReceivedAt: now.toISOString(),
    });

    const elapsedSeconds = Math.min(this.config.maxSeconds, interview.elapsedSeconds + duration);
    const finished =
      interview.status === 'processing' ||
      parseStateV2(interview.state).wrapUpDone ||
      this.config.maxSeconds - elapsedSeconds < MIN_REMAINING_FOR_RECONNECT;
    await this.repo.updateInterview(
      interview.id,
      finished
        ? {
            status: 'processing',
            elapsedSeconds,
            endedAt: interview.endedAt ?? now.toISOString(),
            reconnectUntil: null,
          }
        : {
            status: 'interrupted',
            elapsedSeconds,
            reconnectUntil: new Date(now.getTime() + this.config.reconnectHours * 3600_000).toISOString(),
          }
    );
  }
}
