export type PracticeAreaCategory = 'taxation' | 'legal' | 'finance_advisory';

export interface PracticeAreaDto {
  id: string;
  name: string;
  category: PracticeAreaCategory;
}
