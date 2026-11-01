import { registerDecorator, type ValidationOptions } from 'class-validator';

// Word limits for the AI drafting brief. A brief with almost no substance ("ABC") used to produce a
// random, made-up article; these minimums make the API reject it instead. Mirrored for live
// feedback in apps/frontend/lib/articles/ai-brief-limits.ts — change both together.
export const AI_BRIEF_LIMITS = {
  topic: { min: 3, max: 25 },
  notes: { min: 25, max: 600 },
  recentDevelopments: { min: 0, max: 400 },
  advice: { min: 10, max: 400 },
  followUpAnswer: { min: 0, max: 250 },
} as const;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Whitespace-separated word count within [min, max]. Non-strings are left to @IsString.
export function WordCount(min: number, max: number, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'wordCount',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} must be between ${min} and ${max} words.`,
        ...options,
      },
      validator: {
        validate(value: unknown) {
          if (typeof value !== 'string') return true;
          const n = countWords(value);
          return n >= min && n <= max;
        },
      },
    });
  };
}
