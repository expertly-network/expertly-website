// brain/openai-sse.ts
// OpenAI chat-completions streaming format, which ElevenLabs' Custom LLM integration consumes.
export const SSE_DONE = 'data: [DONE]\n\n';

export function sseChunk(
  id: string,
  created: number,
  delta: { content?: string; toolCall?: { id: string; name: string } },
  finish: 'stop' | 'tool_calls' | null
): string {
  const d: Record<string, unknown> = {};
  if (delta.content !== undefined) d.content = delta.content;
  if (delta.toolCall)
    d.tool_calls = [{ index: 0, id: delta.toolCall.id, type: 'function', function: { name: delta.toolCall.name, arguments: '{}' } }];
  const body = {
    id,
    object: 'chat.completion.chunk',
    created,
    model: 'growxq-interviewer',
    choices: [{ index: 0, delta: d, finish_reason: finish }],
  };
  return `data: ${JSON.stringify(body)}\n\n`;
}
