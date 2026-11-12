import { describe, expect, it, vi } from 'vitest';
import { InterviewExtractionService } from './interview-extraction.service';
import type { InterviewsRepository } from './interviews.repository';
import type { InterviewScoringService } from './interview-scoring.service';
import type { Drafter } from './brain/drafter';
import type { EmailService } from '../email/email.service';
import type { ElevenLabsClient } from './elevenlabs.client';

const PLAN = { schemaVersion: 2, baselineClaimId: 'c1', claimIds: ['c1'], opening: 'O' };
const row = (o: object = {}) => ({
  id: 'i1',
  memberId: 'm1',
  plan: PLAN,
  ledger: { claims: [] },
  state: { version: 2 },
  extractAttempts: 1,
  audioOptIn: false,
  ...o,
});
const conn = (o: object = {}) => ({
  id: 'c',
  interviewId: 'i1',
  elevenlabsConversationId: 'conv1',
  audioPath: null,
  startedAt: new Date().toISOString(),
  transcriptReceivedAt: 'x',
  transcript: [{ role: 'user', message: 'hi', timeInCallSecs: 0 }],
  ...o,
});

function setup(r = row(), connections = [conn()], verified = true) {
  const repo = {
    listExpiredInterruptions: vi.fn().mockResolvedValue([]),
    claimForExtraction: vi.fn().mockResolvedValue([r]),
    listConnections: vi.fn().mockResolvedValue(connections),
    loadMemberContext: vi.fn().mockResolvedValue({ memberId: 'm1', firstName: 'A', services: [] }),
    updateInterview: vi.fn(),
    findMemberWorkEmail: vi.fn().mockResolvedValue('a@firm.com'),
    uploadAudio: vi.fn(),
    updateConnection: vi.fn(),
    addLlmUsage: vi.fn().mockResolvedValue(undefined),
  } as unknown as InterviewsRepository;
  const scoring = {
    scoreAndStore: vi.fn().mockResolvedValue({ scoringId: 'sc1', result: { claims: [] }, verified }),
  } as unknown as InterviewScoringService;
  const drafter = { draft: vi.fn().mockResolvedValue({ drafts: {}, summary: 'S' }) } as unknown as Drafter;
  const email = { enqueueAutomation: vi.fn().mockResolvedValue('queued') } as unknown as EmailService;
  const mp3 = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(512)]);
  const elevenLabs = {
    conversationAudio: vi.fn().mockResolvedValue(mp3),
    deleteConversation: vi.fn().mockResolvedValue(true),
  } as unknown as ElevenLabsClient;
  return {
    svc: new InterviewExtractionService(repo, scoring, drafter, email, elevenLabs),
    repo,
    scoring,
    drafter,
    email,
    elevenLabs,
  };
}

describe('InterviewExtractionService.run (v2)', () => {
  it('scores (reusing a current scoring), drafts, completes, sets verified and emails', async () => {
    const { svc, repo, scoring, email } = setup();
    await svc.run(() => false);
    expect(scoring.scoreAndStore).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'i1' }),
      expect.any(Array),
      expect.any(Object),
      { reuseCurrent: true }
    );
    expect(repo.updateInterview).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({
        status: 'completed',
        summary: 'S',
        summaryStatus: 'pending',
        verifiedAt: expect.any(String),
      })
    );
    expect(email.enqueueAutomation).toHaveBeenCalledWith(
      'interview_drafts_ready',
      expect.anything(),
      expect.anything()
    );
  });
  it('does not set verified when no claim was evidenced', async () => {
    const { svc, repo } = setup(row(), [conn()], false);
    await svc.run(() => false);
    expect(repo.updateInterview).toHaveBeenCalledWith('i1', expect.objectContaining({ verifiedAt: null }));
  });
  it('deletes the conversation without archiving when the member did not opt in', async () => {
    const { svc, repo, elevenLabs } = setup();
    await svc.run(() => false);
    expect(elevenLabs.conversationAudio).not.toHaveBeenCalled();
    expect(repo.uploadAudio).not.toHaveBeenCalled();
    expect(elevenLabs.deleteConversation).toHaveBeenCalledWith('conv1');
  });
  it('archives then deletes when the member opted in', async () => {
    const { svc, repo, elevenLabs } = setup(row({ audioOptIn: true }));
    await svc.run(() => false);
    expect(repo.uploadAudio).toHaveBeenCalledWith('i1/c.mp3', expect.any(Buffer));
    expect(elevenLabs.deleteConversation).toHaveBeenCalledWith('conv1');
  });
  it('keeps the ElevenLabs copy when an opted-in archive failed', async () => {
    const { svc, elevenLabs } = setup(row({ audioOptIn: true }));
    (elevenLabs.conversationAudio as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await svc.run(() => false);
    expect(elevenLabs.deleteConversation).not.toHaveBeenCalled();
  });
  it('fails interviews without a ledger', async () => {
    const { svc, repo } = setup(row({ ledger: null }));
    await svc.run(() => false);
    expect(repo.updateInterview).toHaveBeenCalledWith('i1', { status: 'failed', failureReason: 'no_plan' });
  });
  it('deletes a non-opted-in conversation even when the extraction fails with no_transcript', async () => {
    const { svc, repo, elevenLabs } = setup(row(), [
      conn({ transcript: [{ role: 'agent', message: 'hi', timeInCallSecs: 0 }] }),
    ]);
    await svc.run(() => false);
    expect(repo.updateInterview).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ status: 'failed', failureReason: 'no_transcript' })
    );
    expect(elevenLabs.deleteConversation).toHaveBeenCalledWith('conv1');
  });
});
