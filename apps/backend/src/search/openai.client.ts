import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EMBEDDING_DIMENSIONS, OPENAI_TIMEOUT_MS, chatModel, embedModel } from './search.config';

interface OpenAiEmbeddingsResponse {
  data: { index: number; embedding: number[] }[];
}

export interface OpenAiJsonSchema {
  name: string;
  strict: boolean;
  schema: Record<string, unknown>;
}

interface OpenAiChatResponse {
  choices: { message: { content: string } }[];
}

// Messages keep the provider detail for logs / search_outbox.last_error; HttpExceptionFilter never
// returns a 5xx message to the client.
function providerError(message: string): BadGatewayException {
  return new BadGatewayException({ code: 'AI_PROVIDER_ERROR', message });
}

/** Minimal typed OpenAI REST client (the tuned pipeline needs raw json_schema + dimensions). */
@Injectable()
export class OpenAiClient {
  private apiKey(): string {
    const key = process.env.OPENAI_API_KEY;
    if (!key)
      throw new ServiceUnavailableException({ code: 'AI_NOT_CONFIGURED', message: 'OPENAI_API_KEY is not set.' });
    return key;
  }

  /** Embeds `inputs`; the result array is aligned with `inputs` by index. */
  async embed(inputs: string[], timeoutMs: number = OPENAI_TIMEOUT_MS): Promise<number[][]> {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: embedModel(),
        input: inputs,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: 'float',
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 300);
      throw providerError(`OpenAI embeddings ${res.status}: ${text}`);
    }
    const body = (await res.json()) as OpenAiEmbeddingsResponse;
    const out: number[][] = new Array<number[]>(inputs.length);
    for (const item of body.data) {
      if (item.embedding.length !== EMBEDDING_DIMENSIONS) {
        throw providerError(`Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${item.embedding.length}.`);
      }
      out[item.index] = item.embedding;
    }
    if (out.length !== inputs.length || out.some((e) => !e)) {
      throw providerError('OpenAI embeddings response did not cover every input.');
    }
    return out;
  }

  /** Chat completion constrained by a strict json_schema; returns the parsed JSON message. */
  async chatJson<T>(system: string, user: string, schema: OpenAiJsonSchema, timeoutMs: number): Promise<T> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: chatModel(),
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_schema', json_schema: schema },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      const text = (await res.text()).slice(0, 200);
      throw providerError(`OpenAI chat/completions ${res.status}: ${text}`);
    }
    const body = (await res.json()) as OpenAiChatResponse;
    return JSON.parse(body.choices[0].message.content) as T;
  }
}
