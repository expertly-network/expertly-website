import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { generateText, Output, streamText, type LanguageModel, type LanguageModelUsage, type ModelMessage } from 'ai';
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
export interface LlmUsage {
  input: number;
  output: number;
  cached: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const CALL_CONNECTED = '(The call has connected.)';
const NOTES_TAG = /<\s*\/?\s*interviewer_notes[^>]*>/gi;

/**
 * A voice conversation starts with the agent's greeting, but some providers (Anthropic) require
 * the first message to be the user's. Prepends a neutral user line in that case.
 */
export function normaliseMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages[0]?.role === 'assistant' ? [{ role: 'user', content: CALL_CONNECTED }, ...messages] : messages;
}

/** Member text can never carry our notes tag (it would read as an operator instruction). */
export function stripNotesTag(text: string): string {
  return text.replace(NOTES_TAG, '');
}

/**
 * History first (cache breakpoint on its last message, so the growing conversation is reused turn
 * to turn), then this turn's interviewer notes as a final user message (spec §9.2).
 */
export function buildTurnMessages(messages: ChatMessage[], notes?: string): ModelMessage[] {
  const history = normaliseMessages(messages).map(
    (m): ModelMessage =>
      m.role === 'user'
        ? { role: 'user', content: stripNotesTag(m.content) }
        : { role: 'assistant', content: m.content }
  );
  if (!notes) return history;
  const cached = history.map((m, i) =>
    i === history.length - 1 ? { ...m, providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } } } : m
  ) as ModelMessage[];
  return [...cached, { role: 'user', content: `<interviewer_notes>\n${notes}\n</interviewer_notes>` }];
}

function toUsage(u: LanguageModelUsage | undefined): LlmUsage {
  return {
    input: u?.inputTokens ?? 0,
    output: u?.outputTokens ?? 0,
    cached: u?.inputTokenDetails?.cacheReadTokens ?? 0,
  };
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

  private spec(role: LlmRole): ModelSpec {
    const spec = role === 'turn' ? this.config.turn : this.config.reasoning;
    if (!spec)
      throw new ServiceUnavailableException({
        code: 'INTERVIEW_PROVIDER_UNAVAILABLE',
        message: 'The interviewer is not configured.',
      });
    return spec;
  }

  /** "provider:model", stored with each scoring run. */
  modelName(role: LlmRole): string {
    const spec = this.spec(role);
    return `${spec.provider}:${spec.model}`;
  }

  async object<T>(
    role: LlmRole,
    input: {
      system: string;
      prompt: string;
      schema: z.ZodType<T>;
      maxOutputTokens: number;
      timeoutMs?: number;
      onUsage?: (usage: LlmUsage) => void;
    }
  ): Promise<T> {
    try {
      const result = await generateText({
        model: toModel(this.spec(role)),
        system: input.system,
        prompt: input.prompt,
        output: Output.object({ schema: input.schema }),
        maxOutputTokens: input.maxOutputTokens,
        abortSignal: AbortSignal.timeout(input.timeoutMs ?? DEFAULT_TIMEOUT_MS),
        maxRetries: 1,
      });
      input.onUsage?.(toUsage(result.usage));
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
    input: {
      system: string;
      messages: ChatMessage[];
      notes?: string;
      maxOutputTokens: number;
      abortSignal?: AbortSignal;
      onUsage?: (usage: LlmUsage) => void;
    }
  ): AsyncIterable<string> {
    const result = streamText({
      model: toModel(this.spec(role)),
      system: input.system,
      messages: buildTurnMessages(input.messages, input.notes),
      maxOutputTokens: input.maxOutputTokens,
      abortSignal: input.abortSignal,
      maxRetries: 0,
    });
    if (input.onUsage) {
      const report = input.onUsage;
      void Promise.resolve(result.usage)
        .then((u) => report(toUsage(u)))
        .catch(() => undefined);
    }
    return result.textStream;
  }
}
