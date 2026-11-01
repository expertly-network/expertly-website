import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiFollowUpQuestionsDto } from './ai-followup-questions.dto';
import { AiDraftRequestDto } from './ai-draft-request.dto';

const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(' ');
const valid = { topic: 'GST on rent for landlords', notes: words(30), advice: words(12) };

async function failingFields(cls: typeof AiFollowUpQuestionsDto | typeof AiDraftRequestDto, body: object) {
  const errors = await validate(plainToInstance(cls, body));
  return errors.map((e) => e.property).sort();
}

describe('AI brief word limits', () => {
  it('accepts a substantive brief', async () => {
    expect(await failingFields(AiFollowUpQuestionsDto, valid)).toEqual([]);
    expect(await failingFields(AiDraftRequestDto, valid)).toEqual([]);
  });

  it('rejects a one-word brief like "ABC"', async () => {
    const body = { topic: 'ABC', notes: 'ABC', advice: 'ABC' };
    expect(await failingFields(AiFollowUpQuestionsDto, body)).toEqual(['advice', 'notes', 'topic']);
    expect(await failingFields(AiDraftRequestDto, body)).toEqual(['advice', 'notes', 'topic']);
  });

  it('requires topic, notes and advice on the draft request', async () => {
    expect(await failingFields(AiDraftRequestDto, {})).toEqual(['advice', 'notes', 'topic']);
  });

  it('caps recent developments and follow-up answers', async () => {
    expect(await failingFields(AiDraftRequestDto, { ...valid, recentDevelopments: words(401) })).toEqual([
      'recentDevelopments',
    ]);
    expect(
      await failingFields(AiDraftRequestDto, {
        ...valid,
        followUpAnswers: [{ question: 'Who is affected?', answer: words(251) }],
      })
    ).toEqual(['followUpAnswers']);
  });
});
