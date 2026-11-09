import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { generateText, Output, streamText, type LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { z } from 'zod';
import { InterviewConfig, type ModelSpec } from './interview.config';

export type LlmRole = 'turn' | 'reasoning';
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const CALL_CONNECTED = '(The call has connected.)';

/**
 * A voice conversation starts with the agent's greeting, but some providers (Anthropic) require
 * the first message to be the user's. Prepends a neutral user line in that case.
 */
export function normaliseMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages[0]?.role === 'assistant' ? [{ role: 'user', content: CALL_CONNECTED }, ...messages] : messages;
}

function toModel(spec: ModelSpec): LanguageModel {
  switch (spec.provider) {
    case 'openai':
      return createOpenAI({ apiKey: spec.apiKey })(spec.model);
    case 'anthropic':
      return createAnthropic({ apiKey: spec.apiKey })(spec.model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey: spec.apiKey })(spec.model);
  }
}

/** The only class in the interviewer that talks to the `ai` SDK. Brain classes depend on it. */
@Injectable()
export class InterviewLlmService {
  constructor(private readonly config: InterviewConfig) {}

  private model(role: LlmRole): LanguageModel {
    const spec = role === 'turn' ? this.config.turn : this.config.reasoning;
    if (!spec)
      throw new ServiceUnavailableException({
        code: 'INTERVIEW_PROVIDER_UNAVAILABLE',
        message: 'The interviewer is not configured.',
      });
    return toModel(spec);
  }

  async object<T>(
    role: LlmRole,
    input: { system: string; prompt: string; schema: z.ZodType<T>; maxOutputTokens: number; timeoutMs?: number }
  ): Promise<T> {
    try {
      const result = await generateText({
        model: this.model(role),
        system: input.system,
        prompt: input.prompt,
        output: Output.object({ schema: input.schema }),
        maxOutputTokens: input.maxOutputTokens,
        abortSignal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        maxRetries: 1,
      });
      return input.schema.parse(result.output);
    } catch (error: unknown) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new BadGatewayException({
        code: 'INTERVIEW_LLM_ERROR',
        message: `Interview model call failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  stream(
    role: LlmRole,
    input: { system: string; messages: ChatMessage[]; maxOutputTokens: number; abortSignal?: AbortSignal }
  ): AsyncIterable<string> {
    const result = streamText({
      model: this.model(role),
      system: input.system,
      messages: normaliseMessages(input.messages),
      maxOutputTokens: input.maxOutputTokens,
      abortSignal: input.abortSignal,
      maxRetries: 0,
    });
    return result.textStream;
  }
}
