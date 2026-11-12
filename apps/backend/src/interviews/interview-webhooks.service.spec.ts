// interview-webhooks.service.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { InterviewWebhooksService } from './interview-webhooks.service';
import { hashSessionToken } from './session-token';
import { emptyStateV2 } from './brain/types';
import type { InterviewsRepository } from './interviews.repository';
import type { InterviewConfig } from './interview.config';

const config = { maxSeconds: 1800, reconnectHours: 24 } as InterviewConfig;

function setup(opts: { status?: string; elapsed?: number; wrapUpDone?: boolean; already?: boolean } = {}) {
  const repo = {
    findByTokenHash: vi.fn().mockResolvedValue({
      connection: { id: 'c1', interviewId: 'i1', transcriptReceivedAt: opts.already ? 'x' : null },
      interview: {
        id: 'i1',
        status: opts.status ?? 'in_progress',
        elapsedSeconds: opts.elapsed ?? 0,
        state: { ...emptyStateV2(), wrapUpDone: opts.wrapUpDone ?? false },
      },
    }),
    updateConnection: vi.fn(),
    updateInterview: vi.fn(),
  } as unknown as InterviewsRepository;
  return { service: new InterviewWebhooksService(repo, config), repo };
}

const transcription = (duration: number) => ({
  type: 'post_call_transcription',
  data: {
    conversation_id: 'conv_1',
    transcript: [
      { role: 'agent', message: 'Hi', time_in_call_secs: 0 },
      { role: 'user', message: 'Hello', time_in_call_secs: 2 },
      { role: 'user', message: '', time_in_call_secs: 3 },
    ],
    metadata: { call_duration_secs: duration },
    conversation_initiation_client_data: { dynamic_variables: { session_token: 'tok' } },
  },
});

describe('InterviewWebhooksService', () => {
  it('matches the connection by session token hash and stores the transcript', async () => {
    const { service, repo } = setup();
    await service.handle(transcription(600));
    expect(repo.findByTokenHash).toHaveBeenCalledWith(hashSessionToken('tok'));
    const patch = (repo.updateConnection as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      transcript: unknown[];
      durationSeconds: number;
    };
    expect(patch.transcript).toHaveLength(2);
    expect(patch.durationSeconds).toBe(600);
  });
  it('marks a dropped call interrupted with a 24h window', async () => {
    const { service, repo } = setup();
    await service.handle(transcription(600));
    const patch = (repo.updateInterview as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      status: string;
      elapsedSeconds: number;
      reconnectUntil: string;
    };
    expect(patch.status).toBe('interrupted');
    expect(patch.elapsedSeconds).toBe(600);
    expect(Date.parse(patch.reconnectUntil) - Date.now()).toBeGreaterThan(23 * 3600_000);
  });
  it('moves to processing after a completed wrap-up', async () => {
    const { service, repo } = setup({ wrapUpDone: true });
    await service.handle(transcription(1300));
    expect((repo.updateInterview as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ status: 'processing' });
  });
  it('moves to processing when under 3 minutes would remain', async () => {
    const { service, repo } = setup({ elapsed: 1200 });
    await service.handle(transcription(450));
    expect((repo.updateInterview as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ status: 'processing' });
  });
  it('keeps processing when the member already ended it', async () => {
    const { service, repo } = setup({ status: 'processing' });
    await service.handle(transcription(300));
    expect((repo.updateInterview as ReturnType<typeof vi.fn>).mock.calls[0][1]).toMatchObject({ status: 'processing' });
  });
  it('ignores a duplicate delivery', async () => {
    const { service, repo } = setup({ already: true });
    await service.handle(transcription(300));
    expect(repo.updateConnection).not.toHaveBeenCalled();
  });
  it('ignores audio webhooks (the worker downloads audio instead)', async () => {
    const { service, repo } = setup();
    await service.handle({ type: 'post_call_audio', data: { conversation_id: 'conv_9', full_audio: 'AAAA' } });
    expect(repo.updateConnection).not.toHaveBeenCalled();
  });
});
