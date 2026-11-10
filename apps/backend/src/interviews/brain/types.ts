import { z } from 'zod';

export const OBJECTIVE_KIND_VALUES = [
  'signature_engagement',
  'niche_depth',
  'differentiation',
  'ideal_client',
  'consistency_check',
] as const;
export type ObjectiveKind = (typeof OBJECTIVE_KIND_VALUES)[number];

export const objectiveSchema = z.object({
  id: z.string().min(1).max(60),
  kind: z.enum(OBJECTIVE_KIND_VALUES),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  rationale: z.string().max(300),
  seedQuestions: z.array(z.string().max(400)).min(1).max(3),
  facts: z.array(z.string().max(60)).min(1).max(12),
  budgetSeconds: z.number().int().min(30).max(900),
});
export type Objective = z.infer<typeof objectiveSchema>;

export const planSchema = z.object({
  schemaVersion: z.number().int(),
  opening: z.string().min(1).max(600),
  objectives: z.array(objectiveSchema).min(3).max(10),
  knownFacts: z.array(z.string().max(300)).max(40),
  confirmFacts: z.array(z.object({ fact: z.string().max(300), reason: z.string().max(300) })).max(2),
  sensitivities: z.array(z.string().max(300)).max(10),
});
export type InterviewPlan = z.infer<typeof planSchema>;

/**
 * A plan as stored on the interview. Looser than planSchema (which validates the planner's own
 * output): the analyst may add or drop objectives mid-call, so the 3–10 bound no longer holds.
 */
export const storedPlanSchema = planSchema.extend({ objectives: z.array(objectiveSchema).max(30) });

export const analystUpdateSchema = z.object({
  filledFacts: z.array(z.object({ objectiveId: z.string(), fact: z.string(), value: z.string().max(500) })).max(20),
  currentObjectiveDone: z.boolean(),
  nextObjectiveId: z.string().nullable(),
  planChanges: z
    .array(
      z.discriminatedUnion('op', [
        z.object({ op: z.literal('add'), objective: objectiveSchema }),
        z.object({
          op: z.literal('reprioritise'),
          objectiveId: z.string(),
          priority: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        }),
        z.object({ op: z.literal('drop'), objectiveId: z.string() }),
      ])
    )
    .max(5),
  modes: z.object({ anonymiseClients: z.boolean().optional(), memberShortOnTime: z.boolean().optional() }),
  engagement: z.enum(['high', 'normal', 'low']),
  /** The member's answer, if the last agent turn offered more time. */
  extensionAnswer: z.enum(['yes', 'no']).nullable(),
  /** The last exchange included one of the plan's confirmFacts checks. */
  confirmationAsked: z.boolean(),
  guidance: z.string().max(400),
});
export type AnalystUpdate = z.infer<typeof analystUpdateSchema>;

// OpenAI Structured Outputs rejects the discriminated union above (`oneOf`). Use one
// nullable shape at the model boundary, then validate the operation-specific fields.
export const analystModelUpdateSchema = analystUpdateSchema.omit({ planChanges: true, modes: true }).extend({
  planChanges: z
    .array(
      z.object({
        op: z.enum(['add', 'reprioritise', 'drop']),
        objective: objectiveSchema.nullable(),
        objectiveId: z.string().nullable(),
        priority: objectiveSchema.shape.priority.nullable(),
      })
    )
    .max(5),
  modes: z.object({ anonymiseClients: z.boolean(), memberShortOnTime: z.boolean() }),
});

/** member_interviews.state — the live conversation state (spec §6.2). */
export interface InterviewState {
  version: 1;
  facts: Record<string, Record<string, string>>;
  currentObjectiveId: string | null;
  doneObjectiveIds: string[];
  modes: { anonymiseClients: boolean; memberShortOnTime: boolean };
  engagement: 'high' | 'normal' | 'low';
  guidance: string;
  confirmedFacts: number;
  extension: { offeredAt: string | null; accepted: boolean | null };
  /** Agent turns spoken in the wrap_up phase: 0 → read-back, 1 → goodbye + end_call. */
  wrapUpTurns: number;
  wrapUpDone: boolean;
}

export function emptyState(): InterviewState {
  return {
    version: 1,
    facts: {},
    currentObjectiveId: null,
    doneObjectiveIds: [],
    modes: { anonymiseClients: false, memberShortOnTime: false },
    engagement: 'normal',
    guidance: '',
    confirmedFacts: 0,
    extension: { offeredAt: null, accepted: null },
    wrapUpTurns: 0,
    wrapUpDone: false,
  };
}

/** Reads a stored state document, falling back to defaults for missing keys (forward-compatible). */
export function parseState(raw: unknown): InterviewState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  return { ...base, ...(raw as Partial<InterviewState>), version: 1 };
}

/** What the planner and turn prompt know about the member (read by InterviewsRepository). */
export interface MemberContext {
  memberId: string;
  firstName: string;
  headline: string | null;
  bio: string | null;
  yearsOfExperience: number | null;
  city: string | null;
  country: string | null;
  firmName: string | null;
  workExperiences: unknown[];
  educations: unknown[];
  engagements: unknown[];
  keyClients: unknown[];
  /** "Service line → Category → Service" strings, custom "Other" labels resolved. */
  services: { serviceLine: string; category: string; service: string }[];
}

export interface TranscriptTurn {
  role: 'agent' | 'user';
  message: string;
  timeInCallSecs: number | null;
}
