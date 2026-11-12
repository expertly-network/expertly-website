import { describe, expect, it, vi } from 'vitest';
import { buildDrafterPrompt, Drafter } from './drafter';
import type { InterviewLlmService } from '../interview-llm.service';
import type { InterviewScoringResultDto } from '@shared/interview';

const SCORING = {
  claims: [
    {
      claimId: 'c1',
      claimText: 'Bilateral APA',
      probed: true,
      role: 5,
      evidence: 'E3',
      evidenceSummary: 'Led a bilateral APA.',
    },
    { claimId: 'c2', claimText: 'M&A tax', probed: true, role: 1, evidence: 'E1', evidenceSummary: '' },
  ],
} as unknown as InterviewScoringResultDto;
const INPUT = {
  transcript: [{ role: 'user' as const, message: 'I led the APA. Email me at a@b.com', timeInCallSecs: 1 }],
  member: { memberId: 'm', firstName: 'A', services: [] } as never,
  scoring: SCORING,
};

describe('buildDrafterPrompt', () => {
  it('lists evidenced work by role and keeps firm-level work out of it', () => {
    const { prompt } = buildDrafterPrompt(INPUT);
    expect(prompt).toContain('Bilateral APA — led: Led a bilateral APA.');
    expect(prompt).not.toContain('M&A tax —');
  });
});

describe('Drafter.draft', () => {
  it('redacts the summary and drops empty draft sections', async () => {
    const llm = {
      object: vi.fn().mockResolvedValue({
        drafts: { headlineBio: null, engagements: [], keyClients: null },
        summary: 'Transfer pricing adviser. Reach her at a@b.com.',
      }),
    } as unknown as InterviewLlmService;
    const out = await new Drafter(llm).draft(INPUT);
    expect(out.drafts).toEqual({});
    expect(out.summary).not.toContain('a@b.com');
  });
});
