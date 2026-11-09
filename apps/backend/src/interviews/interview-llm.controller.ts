// interview-llm.controller.ts
import { Body, Controller, HttpCode, Logger, Post, Res, UseGuards } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Public } from '../auth/decorators/public.decorator';
import { SSE_DONE, sseChunk } from './brain/openai-sse';
import { TurnEngine } from './brain/turn-engine';
import { InterviewLlmGuard } from './interview-llm.guard';
import type { ChatMessage } from './interview-llm.service';

// OpenAI chat-completions request as ElevenLabs sends it. Only what we use is validated; the
// system message ElevenLabs sends is ignored (the turn engine builds its own, spec §4.2).
const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.string(),
        content: z.union([z.string(), z.array(z.object({ type: z.string(), text: z.string().optional() })), z.null()]).optional(),
      })
    )
    .max(400),
  tools: z.array(z.object({ function: z.object({ name: z.string() }).optional() })).optional(),
  elevenlabs_extra_body: z.object({ sessionToken: z.string().min(1).max(100) }),
});

function toChat(messages: z.infer<typeof requestSchema>['messages']): ChatMessage[] {
  return messages.flatMap((m): ChatMessage[] => {
    if (m.role !== 'user' && m.role !== 'assistant') return [];
    const text = typeof m.content === 'string' ? m.content : (m.content ?? []).map((p) => p.text ?? '').join('');
    return text.trim() ? [{ role: m.role, content: text }] : [];
  });
}

@Public()
@UseGuards(InterviewLlmGuard)
@Controller('interviews/llm')
export class InterviewLlmController {
  private readonly logger = new Logger(InterviewLlmController.name);
  constructor(private readonly engine: TurnEngine) {}

  @Post('chat/completions')
  @HttpCode(200)
  async complete(@Body() body: unknown, @Res() reply: FastifyReply): Promise<void> {
    const parsed = requestSchema.safeParse(body);
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    const id = `chatcmpl-${randomUUID()}`;
    const created = Math.floor(Date.now() / 1000);
    const abort = new AbortController();
    raw.on('close', () => abort.abort());
    try {
      if (!parsed.success) {
        raw.write(sseChunk(id, created, { content: "Sorry, let's try that again." }, null));
      } else {
        const canEndCall = (parsed.data.tools ?? []).some((t) => t.function?.name === 'end_call');
        for await (const chunk of this.engine.run({
          sessionToken: parsed.data.elevenlabs_extra_body.sessionToken,
          messages: toChat(parsed.data.messages),
          canEndCall,
          abortSignal: abort.signal,
        })) {
          if (chunk.type === 'text') raw.write(sseChunk(id, created, { content: chunk.text }, null));
          else {
            raw.write(sseChunk(id, created, { toolCall: { id: `call_${randomUUID()}`, name: 'end_call' } }, 'tool_calls'));
          }
        }
      }
      raw.write(sseChunk(id, created, {}, 'stop'));
    } catch (error: unknown) {
      this.logger.error(`Interview turn failed: ${error instanceof Error ? error.message : String(error)}`);
      raw.write(sseChunk(id, created, { content: 'Sorry, could you say that again?' }, 'stop'));
    } finally {
      raw.write(SSE_DONE);
      raw.end();
    }
  }
}
