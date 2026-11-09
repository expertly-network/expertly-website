// interview-extraction.service.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { InterviewExtractionService } from './interview-extraction.service';
import { emptyState } from './brain/types';
import type { InterviewsRepository } from './interviews.repository';
import type { Extractor } from './brain/extractor';
import type { EmailService } from '../email/email.service';
import type { ElevenLabsClient } from './elevenlabs.client';

const PLAN = {
  schemaVersion: 1,
  opening: 'o',
  objectives: [
    {
      id: 'e1',
      kind: 'signature_engagement',
      priority: 1,
      rationale: '',
      seedQuestions: ['q'],
      facts: ['x'],
      budgetSeconds: 60,
    },
  ],
  knownFacts: [],
  confirmFacts: [],
  sensitivities: [],
};
const row = { id: 'i1', memberId: 'm1', plan: PLAN, state: emptyState(), extractAttempts: 1 };

function setup(connections: object[]) {
  const repo = {
    listExpiredInterruptions: vi.fn().mockResolvedValue([{ id: 'old' }]),
    claimForExtraction: vi.fn().mockResolvedValue([row]),
    listConnections: vi.fn().mockResolvedValue(connections),
    loadMemberContext: vi.fn().mockResolvedValue({ memberId: 'm1', firstName: 'A', services: [] }),
    updateInterview: vi.fn(),
    findMemberWorkEmail: vi.fn().mockResolvedValue('a@firm.com'),
    uploadAudio: vi.fn(),
    updateConnection: vi.fn(),
  } as unknown as InterviewsRepository;
  const extractor = {
    extract: vi.fn().mockResolvedValue({ drafts: {}, summary: 'S', assessment: { depth: 3 } }),
  } as unknown as Extractor;
  const email = { enqueueAutomation: vi.fn().mockResolvedValue('queued') } as unknown as EmailService;
  // An MPEG-1 Layer III frame header: enough for magic-byte sniffing.
  const mp3 = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x64]), Buffer.alloc(512)]);
  const elevenLabs = { conversationAudio: vi.fn().mockResolvedValue(mp3) } as unknown as ElevenLabsClient;
  return {
    svc: new InterviewExtractionService(repo, extractor, email, elevenLabs),
    repo,
    extractor,
    email,
    elevenLabs,
  };
}
const conn = (o: object) => ({
  id: 'c',
  startedAt: new Date().toISOString(),
  transcriptReceivedAt: 'x',
  transcript: [{ role: 'user', message: 'hi', timeInCallSecs: 0 }],
  ...o,
});

describe('InterviewExtractionService.run', () => {
  it('finalises expired interruptions, extracts, completes and emails', async () => {
    const { svc, repo, email } = setup([conn({})]);
    await svc.run(() => false);
    expect(repo.updateInterview).toHaveBeenCalledWith('old', expect.objectContaining({ status: 'processing' }));
    expect(repo.updateInterview).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ status: 'completed', summary: 'S', summaryStatus: 'pending' })
    );
    expect(email.enqueueAutomation).toHaveBeenCalledWith(
      'interview_drafts_ready',
      { profileId: 'm1', workEmail: 'a@firm.com' },
      { idempotencyKey: 'interview_drafts_ready:i1' }
    );
  });
  it('releases the claim while a recent transcript is still missing', async () => {
    const { svc, repo, extractor } = setup([conn({ transcriptReceivedAt: null, transcript: null })]);
    await svc.run(() => false);
    expect(extractor.extract).not.toHaveBeenCalled();
    expect(repo.updateInterview).toHaveBeenCalledWith('i1', { extractClaimedAt: null, extractAttempts: 0 });
  });
  it('fails an interview where the member never spoke', async () => {
    const { svc, repo } = setup([conn({ transcript: [{ role: 'agent', message: 'Hi', timeInCallSecs: 0 }] })]);
    await svc.run(() => false);
    expect(repo.updateInterview).toHaveBeenCalledWith(
      'i1',
      expect.objectContaining({ status: 'failed', failureReason: 'no_transcript' })
    );
  });
  it("archives each connection's audio before extracting", async () => {
    const { svc, repo, elevenLabs } = setup([
      conn({ elevenlabsConversationId: 'conv_1', audioPath: null, interviewId: 'i1' }),
    ]);
    await svc.run(() => false);
    expect(elevenLabs.conversationAudio).toHaveBeenCalledWith('conv_1');
    expect(repo.uploadAudio).toHaveBeenCalledWith('i1/c.mp3', expect.any(Buffer));
    expect(repo.updateConnection).toHaveBeenCalledWith('c', expect.objectContaining({ audioPath: 'i1/c.mp3' }));
  });
});
