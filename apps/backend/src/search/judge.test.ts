import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { judgePrompt, matchLines, questionTokens, trimCard } from './judge';
import { plannerPrompt } from './planner';

describe('trimCard', () => {
  it('caps a member card at 2000 chars (+ ellipsis)', () => {
    const card = Array.from({ length: 30 }, (_, i) => `Line${i}: ${'x'.repeat(390)}`).join('\n');
    const out = trimCard('member', card);
    expect(out.length).toBe(2003);
    expect(out.endsWith('...')).toBe(true);
  });
  it('clips About: lines at 320 and other member lines at 400', () => {
    const out = trimCard('member', `About: ${'a'.repeat(500)}\nFirm: ${'b'.repeat(500)}`);
    const [about, firm] = out.split(' | ');
    expect(about.length).toBe(323);
    expect(firm.length).toBe(403);
  });
  it('caps articles at 800 and events at 500', () => {
    expect(trimCard('article', 'Body: ' + 'z'.repeat(2000)).length).toBeLessThanOrEqual(203);
    expect(trimCard('event', 'e'.repeat(2000)).length).toBe(503);
  });
});

describe('matchLines / questionTokens', () => {
  it('drops stop-words and short tokens', () => {
    expect(questionTokens('who has worked with Tata Motors')).toEqual(['tata', 'motors']);
  });
  it('quotes at most 4 matching card lines', () => {
    const content = Array.from({ length: 6 }, () => 'tax line').join('\n');
    expect(matchLines(content, ['tax']).split(' | ')).toHaveLength(4);
  });
});

// The prompts are tuned and must stay VERBATIM. This diffs them against the reference copy of the
// Edge Function. Never edit a prompt to make this pass.
const REFERENCE = join(__dirname, '../../../../docs/ai-search/reference/edge-functions/pipeline.ts.txt');
describe.skipIf(!existsSync(REFERENCE))('prompts are verbatim from the reference', () => {
  const ref = existsSync(REFERENCE) ? readFileSync(REFERENCE, 'utf8') : '';
  const body = (fn: string): string => {
    const start = ref.indexOf(`function ${fn}`);
    const open = ref.indexOf('return `', start) + 'return `'.length;
    return ref.slice(open, ref.indexOf('`;', open));
  };

  it('planner prompt', () => {
    expect(plannerPrompt('TODAY')).toBe(body('plannerPrompt').replace('${today}', 'TODAY'));
  });
  it('judge prompt (scores applied)', () => {
    const expected = body('judgePrompt')
      .replace(/\$\{minScore\}/g, '3')
      .replace("${applyScores ? '' : 'All candidates already match the filters, so give every candidate a score of 10.'}", '');
    expect(judgePrompt(3, true)).toBe(expected);
  });
  it('judge prompt (all candidates already match)', () => {
    const expected = body('judgePrompt')
      .replace(/\$\{minScore\}/g, '3')
      .replace("${applyScores ? '' : 'All candidates already match the filters, so give every candidate a score of 10.'}", 'All candidates already match the filters, so give every candidate a score of 10.');
    expect(judgePrompt(3, false)).toBe(expected);
  });
});
