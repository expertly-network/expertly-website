export type PracticeAreaCategory = 'taxation' | 'legal' | 'finance_advisory';

export interface PracticeAreaDto {
  id: string;
  name: string;
  category: PracticeAreaCategory;
  // Decorative-only representative image (directory/homepage chip art) — null until set,
  // never blocks rendering.
  imageUrl: string | null;
}
