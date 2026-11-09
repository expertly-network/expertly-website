import { describe, expect, it } from 'vitest';
import { normaliseMessages } from './interview-llm.service';

describe('normaliseMessages', () => {
  it('prepends a user line when the conversation starts with the agent greeting', () => {
    const out = normaliseMessages([
      { role: 'assistant', content: 'Hi, shall we begin?' },
      { role: 'user', content: 'Yes' },
    ]);
    expect(out[0].role).toBe('user');
    expect(out).toHaveLength(3);
  });
  it('leaves a conversation that starts with the user untouched', () => {
    const messages = [{ role: 'user' as const, content: 'Hello' }];
    expect(normaliseMessages(messages)).toBe(messages);
  });
  it('handles an empty history', () => {
    expect(normaliseMessages([])).toEqual([]);
  });
});
