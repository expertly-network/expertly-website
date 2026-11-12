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

describe('ElevenLabsClient.conversationAudio', () => {
  it('downloads the conversation audio', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const audio = await new ElevenLabsClient(config).conversationAudio('conv_1');
    expect(audio?.length).toBe(3);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.elevenlabs.io/v1/convai/conversations/conv_1/audio');
  });
  it('returns null when the audio is not available', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 404 })));
    await expect(new ElevenLabsClient(config).conversationAudio('conv_1')).resolves.toBeNull();
  });
});

describe('ElevenLabsClient.deleteConversation', () => {
  it('sends DELETE and reports success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(new ElevenLabsClient(config).deleteConversation('conv_1')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.elevenlabs.io/v1/convai/conversations/conv_1',
      expect.objectContaining({ method: 'DELETE' })
    );
  });
  it('never throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    await expect(new ElevenLabsClient(config).deleteConversation('c')).resolves.toBe(false);
  });
});
