import type { PerkCategory, LearningCategory, ResourceAudience, TemplateCategory } from '@shared/resource';
export const perkCategories: PerkCategory[] = [
  'Tax & Compliance',
  'Accounting & Audit',
  'Corporate Secretarial',
  'Legal',
  'AI Tools',
  'Practice & Productivity',
];
export const learningCategories: LearningCategory[] = [
  'AI essentials',
  'Legal & drafting',
  'Tax & accounting',
  'Audit & assurance',
  'Excel & decks',
  'Automation',
  'Data & privacy',
];
export const templateCategories: TemplateCategory[] = [
  'Audit',
  'Tax',
  'Legal',
  'Corporate & compliance',
  'Practice management',
];
export const audiences: { value: ResourceAudience; label: string }[] = [
  { value: 'tax', label: 'Tax & accounting' },
  { value: 'legal', label: 'Law' },
  { value: 'audit', label: 'Audit' },
];
