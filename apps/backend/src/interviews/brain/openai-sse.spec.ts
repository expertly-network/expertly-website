// brain/openai-sse.spec.ts
import { describe, expect, it } from 'vitest';
import { SSE_DONE, sseChunk } from './openai-sse';

describe('sseChunk', () => {
  it('formats a content delta as an OpenAI chat.completion.chunk', () => {
    const line = sseChunk('c1', 100, { content: 'Hi' }, null);
    expect(line.startsWith('data: ')).toBe(true);
    expect(line.endsWith('\n\n')).toBe(true);
    const body = JSON.parse(line.slice(6));
    expect(body).toMatchObject({ id: 'c1', object: 'chat.completion.chunk', created: 100, choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }] });
  });
  it('formats an end_call tool call', () => {
    const body = JSON.parse(sseChunk('c1', 100, { toolCall: { id: 'call_1', name: 'end_call' } }, 'tool_calls').slice(6));
    expect(body.choices[0].delta.tool_calls[0]).toEqual({ index: 0, id: 'call_1', type: 'function', function: { name: 'end_call', arguments: '{}' } });
    expect(body.choices[0].finish_reason).toBe('tool_calls');
  });
  it('has the DONE terminator', () => expect(SSE_DONE).toBe('data: [DONE]\n\n'));
});
