import { describe, expect, it } from 'vitest';
import { parseSummaryResponse } from './ai.service';

describe('parseSummaryResponse', () => {
  it('strips bullets and keeps one takeaway per line, at most five', () => {
    const text = ['- One takeaway here.', '• Two takeaway here.', '3. Three takeaway here.', '4) Four', '5', '6'].join(
      '\n'
    );
    expect(parseSummaryResponse(text).split('\n')).toEqual([
      'One takeaway here.',
      'Two takeaway here.',
      'Three takeaway here.',
      'Four',
      '5',
    ]);
  });

  it('splits a single paragraph into separate sentences', () => {
    const text =
      'Long-term gains on listed shares are taxed at 12.5% above Rs 1.25 lakh. Short-term gains are taxed at 20% for equity. Property gains lose indexation for purchases after July 2024.';
    expect(parseSummaryResponse(text).split('\n')).toEqual([
      'Long-term gains on listed shares are taxed at 12.5% above Rs 1.25 lakh.',
      'Short-term gains are taxed at 20% for equity.',
      'Property gains lose indexation for purchases after July 2024.',
    ]);
  });
});
