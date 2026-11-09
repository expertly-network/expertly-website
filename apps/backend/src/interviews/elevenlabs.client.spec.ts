// elevenlabs.client.spec.ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
import { ElevenLabsClient } from './elevenlabs.client';
import type { InterviewConfig } from './interview.config';

const config = {
  elevenLabs: { apiKey: 'xi', agentId: 'agent_1', webhookSecret: 'w', llmSecret: 'l' },
} as unknown as InterviewConfig;

afterEach(() => vi.unstubAllGlobals());

describe('ElevenLabsClient.conversationToken', () => {
  it('calls the token endpoint with the agent id and api key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'tok' }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new ElevenLabsClient(config).conversationToken()).resolves.toBe('tok');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agent_1');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('xi');
  });
  it('maps a failure to INTERVIEW_PROVIDER_UNAVAILABLE', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 500 })));
    await expect(new ElevenLabsClient(config).conversationToken()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
