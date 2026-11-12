import { z } from 'zod';

export const CLAIM_TYPES = ['engagement', 'credential', 'volume', 'seniority', 'specialisation'] as const;
export const CLAIM_SOURCES = ['bio', 'experience', 'engagement', 'selected_service'] as const;
export const CLAIM_FLAGS = ['regime_before_start', 'timeline_conflict', 'selected_no_evidence'] as const;
export type ClaimFlag = (typeof CLAIM_FLAGS)[number];

const year = z.number().int().min(1950).max(2100);

/** A claim as the Preparer model returns it (flat, strict-schema safe). */
export const claimSchema = z.object({
  id: z.string().regex(/^c\d{1,2}$/),
  text: z.string().min(1).max(200),
  serviceIds: z.array(z.string().max(40)).max(6),
  type: z.enum(CLAIM_TYPES),
  periodFrom: year.nullable(),
  periodTo: year.nullable(),
  source: z.enum(CLAIM_SOURCES),
});
export type ModelClaim = z.infer<typeof claimSchema>;
/** A stored claim: the model's claim plus flags computed in code. */
export type Claim = ModelClaim & { flags: ClaimFlag[] };

export const ledgerSchema = z.object({
  claims: z.array(claimSchema.extend({ flags: z.array(z.enum(CLAIM_FLAGS)) })).max(20),
});
export type ClaimLedger = z.infer<typeof ledgerSchema>;

export const preparerOutputSchema = z.object({
  claims: z.array(claimSchema).min(1).max(20),
  baselineClaimId: z.string(),
  claimIds: z.array(z.string()).min(1).max(4),
  opening: z.string().min(1).max(300),
});
export type PreparerOutput = z.infer<typeof preparerOutputSchema>;

export const planV2Schema = z.object({
  schemaVersion: z.literal(2),
  baselineClaimId: z.string(),
  claimIds: z.array(z.string()).min(1).max(4),
  opening: z.string().min(1).max(300),
});
export type InterviewPlanV2 = z.infer<typeof planV2Schema>;

export const FACET_QUESTIONS = ['clients', 'industries', 'jurisdictions', 'scale'] as const;
export type FacetQuestion = (typeof FACET_QUESTIONS)[number];

export type LadderStep = 1 | 2 | 3 | 4 | 5 | 6 | 'facets' | 'close';

/** member_interviews.state — the live ladder state (spec §6.3). */
export interface InterviewStateV2 {
  version: 2;
  currentClaimId: string | null;
  step: LadderStep;
  /** The current step's one re-ask has been used (the next turn is the re-ask). */
  reaskUsed: boolean;
  personalRole: Record<string, boolean | null>;
  facetsDone: Record<string, FacetQuestion[]>;
  doneClaimIds: string[];
  /** Interview seconds elapsed when the current claim started (for the ~4 min budget). */
  claimStartedAtSeconds: number;
  buildOn: string;
  lowConfidenceTerm: string | null;
  /** Messages (ElevenLabs history entries) already read by the Tracker. */
  lastTrackedIndex: number;
  /** Agent turns spoken in the close step: 0 → Q14, 1 → Q15, 2 → goodbye. */
  closeTurns: number;
  stopRequested: boolean;
  wrapUpDone: boolean;
}

export function emptyStateV2(): InterviewStateV2 {
  return {
    version: 2,
    currentClaimId: null,
    step: 1,
    reaskUsed: false,
    personalRole: {},
    facetsDone: {},
    doneClaimIds: [],
    claimStartedAtSeconds: 0,
    buildOn: '',
    lowConfidenceTerm: null,
    lastTrackedIndex: 0,
    closeTurns: 0,
    stopRequested: false,
    wrapUpDone: false,
  };
}

/** Reads a stored state; anything that isn't a v2 document becomes a fresh state. */
export function parseStateV2(raw: unknown): InterviewStateV2 {
  const base = emptyStateV2();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const doc = raw as Partial<InterviewStateV2>;
  if (doc.version !== 2) return base;
  return { ...base, ...doc, version: 2 };
}

export const trackerUpdateSchema = z.object({
  stepCovered: z.boolean(),
  vague: z.boolean(),
  personalRoleShown: z.boolean().nullable(),
  buildOn: z.string().max(160),
  endClaimEarly: z.boolean(),
  facetsAnswered: z.array(z.enum(FACET_QUESTIONS)).max(4),
  memberShortOnTime: z.boolean(),
  memberAskedToStop: z.boolean(),
  lowConfidenceTerm: z.string().max(60).nullable(),
});
export type TrackerUpdate = z.infer<typeof trackerUpdateSchema>;

/** What the preparer and turn engine know about the member (read by InterviewsRepository). */
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
  /** Selected services, custom "Other" labels resolved. */
  services: { serviceId: string; serviceLine: string; category: string; service: string }[];
}

export interface TranscriptTurn {
  role: 'agent' | 'user';
  message: string;
  timeInCallSecs: number | null;
}
