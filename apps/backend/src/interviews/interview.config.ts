import { Injectable } from '@nestjs/common';

export type InterviewProvider = 'openai' | 'anthropic' | 'google';
export interface ModelSpec {
  provider: InterviewProvider;
  model: string;
  apiKey: string;
}
export interface ElevenLabsSettings {
  apiKey: string;
  agentId: string;
  webhookSecret: string;
  llmSecret: string;
}
export interface InterviewSettings {
  enabled: boolean;
  elevenLabs: ElevenLabsSettings | null;
  turn: ModelSpec | null;
  reasoning: ModelSpec | null;
  consentVersion: string;
  maxSeconds: number;
  reconnectHours: number;
}

const PROVIDERS: readonly InterviewProvider[] = ['openai', 'anthropic', 'google'];
const DEFAULT_CONSENT_VERSION = '2026-11-09';

function modelSpec(env: Record<string, string | undefined>, role: 'TURN' | 'REASONING'): ModelSpec | null {
  const provider = env[`INTERVIEW_${role}_PROVIDER`];
  const model = env[`INTERVIEW_${role}_MODEL`];
  const apiKey = env[`INTERVIEW_${role}_API_KEY`];
  if (!provider || !model || !apiKey || !(PROVIDERS as readonly string[]).includes(provider)) return null;
  return { provider: provider as InterviewProvider, model, apiKey };
}

/** Pure: env → settings. The interviewer never reads AI_* / OPENAI_* (spec §10). */
export function readInterviewConfig(env: Record<string, string | undefined>): InterviewSettings {
  const { ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, ELEVENLABS_WEBHOOK_SECRET, ELEVENLABS_LLM_SECRET } = env;
  const elevenLabs =
    ELEVENLABS_API_KEY && ELEVENLABS_AGENT_ID && ELEVENLABS_WEBHOOK_SECRET && ELEVENLABS_LLM_SECRET
      ? {
          apiKey: ELEVENLABS_API_KEY,
          agentId: ELEVENLABS_AGENT_ID,
          webhookSecret: ELEVENLABS_WEBHOOK_SECRET,
          llmSecret: ELEVENLABS_LLM_SECRET,
        }
      : null;
  const turn = modelSpec(env, 'TURN');
  const reasoning = modelSpec(env, 'REASONING');
  return {
    enabled: elevenLabs !== null && turn !== null && reasoning !== null,
    elevenLabs,
    turn,
    reasoning,
    consentVersion: env.INTERVIEW_CONSENT_VERSION || DEFAULT_CONSENT_VERSION,
    maxSeconds: 1800,
    reconnectHours: 24,
  };
}

@Injectable()
export class InterviewConfig implements InterviewSettings {
  readonly enabled: boolean;
  readonly elevenLabs: ElevenLabsSettings | null;
  readonly turn: ModelSpec | null;
  readonly reasoning: ModelSpec | null;
  readonly consentVersion: string;
  readonly maxSeconds: number;
  readonly reconnectHours: number;

  constructor() {
    const s = readInterviewConfig(process.env);
    this.enabled = s.enabled;
    this.elevenLabs = s.elevenLabs;
    this.turn = s.turn;
    this.reasoning = s.reasoning;
    this.consentVersion = s.consentVersion;
    this.maxSeconds = s.maxSeconds;
    this.reconnectHours = s.reconnectHours;
  }
}
