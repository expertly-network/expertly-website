import type { ObjectiveKind } from './types';

/** Bump when objectives or facts change; stored on each plan as schemaVersion. */
export const TARGET_SCHEMA_VERSION = 1;

export const OBJECTIVE_KINDS: Record<
  ObjectiveKind,
  { description: string; facts: string[]; count: [min: number, max: number] }
> = {
  signature_engagement: {
    description:
      'A real engagement the member is proud of: the client situation, their own role, what was hard, and the measurable outcome.',
    facts: [
      'client_type',
      'industry',
      'problem',
      'my_role',
      'team_size',
      'duration',
      'approach',
      'hardest_part',
      'outcome',
      'metric',
      'niche_relevance',
    ],
    count: [2, 3],
  },
  niche_depth: {
    description:
      "Hands-on depth in the member's own services: a hard problem they solved, methods they use, forums or regulators they deal with.",
    facts: ['specialisation', 'hard_problem_example', 'methods_or_frameworks', 'forums_or_regulators'],
    count: [1, 2],
  },
  differentiation: {
    description: 'Why clients choose them, a typical mandate, and what they deliberately do not take on.',
    facts: ['why_clients_choose_me', 'typical_mandate', 'what_i_dont_do'],
    count: [1, 1],
  },
  ideal_client: {
    description: 'Who they serve best: client size, industries, engagement types, geographies.',
    facts: ['client_size', 'industries', 'engagement_types', 'geographies'],
    count: [1, 1],
  },
  consistency_check: {
    description: 'Only when profile and LinkedIn data conflict: a gentle clarification.',
    facts: ['clarification'],
    count: [0, 2],
  },
};
