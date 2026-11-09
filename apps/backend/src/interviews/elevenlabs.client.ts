import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InterviewConfig } from './interview.config';

const TOKEN_URL = 'https://api.elevenlabs.io/v1/convai/conversation/token';

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'INTERVIEW_PROVIDER_UNAVAILABLE',
    message: 'The interview service is unavailable right now. Please try again shortly.',
  });
}

@Injectable()
export class ElevenLabsClient {
  private readonly logger = new Logger(ElevenLabsClient.name);
  constructor(private readonly config: InterviewConfig) {}

  /** A WebRTC conversation token for the private interviewer agent (server-side only). */
  async conversationToken(): Promise<string> {
    const el = this.config.elevenLabs;
    if (!el) throw unavailable();
    try {
      const res = await fetch(`${TOKEN_URL}?agent_id=${encodeURIComponent(el.agentId)}`, {
        headers: { 'xi-api-key': el.apiKey },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.error(`ElevenLabs token request failed: HTTP ${res.status}`);
        throw unavailable();
      }
      const body = (await res.json()) as { token?: unknown };
      if (typeof body.token !== 'string' || !body.token) throw unavailable();
      return body.token;
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(`ElevenLabs token request error: ${error instanceof Error ? error.message : String(error)}`);
      throw unavailable();
    }
  }
}
