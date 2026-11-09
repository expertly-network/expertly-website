import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { runAnalysis, openHighValue } from '../brain/analyst';
import { computeCoverage } from '../brain/extractor';
import { Planner } from '../brain/planner';
import { phaseAt, type TimePhase } from '../brain/time-keeper';
import { bookkeep } from '../brain/turn-engine';
import { buildTurnPrompt } from '../brain/turn-prompt';
import { emptyState, type InterviewPlan, type InterviewState, type MemberContext } from '../brain/types';
import { InterviewConfig } from '../interview.config';
import { InterviewLlmService, type ChatMessage } from '../interview-llm.service';

// Simulated interviews for prompt tuning and latency checks (plan Task 15). Runs a whole interview
// in text with no ElevenLabs and no database: the real planner, turn prompt, analyst and time rules,
// with a persona model playing the member. Uses the INTERVIEW_* model env vars (real API calls).
//
//   cd apps/backend && node_modules/.bin/nest build   (reads .env from apps/backend)
//   node dist/apps/backend/src/interviews/sim/interview-sim.js --persona concise   (or: all)
//
// The analyst is awaited before each turn here (live, it runs alongside), so results are a little
// optimistic about how quickly the plan adapts.

const logger = new Logger('InterviewSim');
const SECONDS_PER_EXCHANGE = 35;
const MAX_EXCHANGES = 60;
const FIRST_MESSAGE = "Hi Asha, I'm the GrowXQ interviewer. This takes about 20 minutes. Shall we begin?";

const PERSONA_BASE = `You are role-playing an expert being interviewed by voice for GrowXQ, a network of vetted
professionals. Reply as the member would speak: natural, first person, no lists or markdown. Stay in
character. Your background: Asha Rao, 14 years in transfer pricing, 9 at a Big-4 firm (Director),
now running her own boutique in Mumbai advising mid-size manufacturers in India and the UK.`;

const PERSONAS: Record<string, string> = {
  concise: 'You are precise and factual. Short answers, always with concrete numbers, durations and your own role.',
  rambler:
    'You ramble: long tangents about industry gossip and old colleagues, and the real facts are buried in the middle.',
  nda: 'You are bound by strict NDAs. Refuse to name any client, and say so whenever clients come up. You are happy to describe industries and sizes.',
  inflated:
    'You are actually a junior analyst who overstates your role. You say "I led" a lot, but get vague and evasive when asked for specifics or numbers.',
  short: 'Early on, say you only have about 10 minutes today. Keep answers brief.',
};

const MEMBER: MemberContext = {
  memberId: 'sim-member',
  firstName: 'Asha',
  headline: 'Transfer pricing advisor to mid-size manufacturers',
  bio: 'Transfer pricing specialist with 14 years of experience across India and the UK.',
  yearsOfExperience: 14,
  city: 'Mumbai',
  country: 'India',
  firmName: 'Rao TP Advisory',
  workExperiences: [
    { title: 'Founder', company: 'Rao TP Advisory', startYear: 2021, isCurrent: true },
    { title: 'Director, Transfer Pricing', company: 'Deloitte', startYear: 2012, endYear: 2021 },
  ],
  educations: [{ degree: 'Chartered Accountant', school: 'ICAI', endYear: 2010 }],
  engagements: [],
  keyClients: [],
  services: [
    { serviceLine: 'Tax', category: 'Direct Tax', service: 'Transfer pricing' },
    { serviceLine: 'Tax', category: 'Direct Tax', service: 'Tax Litigation & Dispute Resolutions' },
  ],
};

interface Report {
  persona: string;
  exchanges: number;
  simulatedMinutes: number;
  coverage: number;
  repeatedQuestions: number;
  phases: TimePhase[];
  extension: InterviewState['extension'];
  modes: InterviewState['modes'];
  wrapUpDone: boolean;
  ttftMsP50: number | null;
  ttftMsP95: number | null;
}

function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function collect(stream: AsyncIterable<string>): Promise<{ text: string; ttftMs: number | null }> {
  const t0 = Date.now();
  let ttftMs: number | null = null;
  let text = '';
  for await (const chunk of stream) {
    if (ttftMs === null) ttftMs = Date.now() - t0;
    text += chunk;
  }
  return { text: text.trim(), ttftMs };
}

async function memberReply(llm: InterviewLlmService, persona: string, messages: ChatMessage[]): Promise<string> {
  // The persona sees the conversation from the member's side: roles flipped.
  const flipped = messages.map(
    (m): ChatMessage => ({ role: m.role === 'user' ? 'assistant' : 'user', content: m.content })
  );
  const { text } = await collect(
    llm.stream('reasoning', {
      system: `${PERSONA_BASE}\n\n${PERSONAS[persona]}`,
      messages: flipped,
      maxOutputTokens: 400,
    })
  );
  return text;
}

async function simulate(llm: InterviewLlmService, persona: string): Promise<Report> {
  let plan: InterviewPlan = await new Planner(llm).plan(MEMBER);
  let state: InterviewState = { ...emptyState(), currentObjectiveId: plan.objectives[0]?.id ?? null };
  logger.log(`[${persona}] plan: ${plan.objectives.map((o) => `${o.id}(p${o.priority})`).join(', ')}`);

  const messages: ChatMessage[] = [{ role: 'assistant', content: FIRST_MESSAGE }];
  const services = MEMBER.services.map((s) => `${s.serviceLine} → ${s.category} → ${s.service}`);
  const phases: TimePhase[] = [];
  const ttfts: number[] = [];
  let elapsed = 0;
  let exchanges = 0;

  while (exchanges < MAX_EXCHANGES && !state.wrapUpDone) {
    const reply = await memberReply(llm, persona, messages);
    messages.push({ role: 'user', content: reply });
    logger.log(`[${persona}] MEMBER: ${reply}`);
    elapsed += SECONDS_PER_EXCHANGE;
    exchanges += 1;

    const analysis = await runAnalysis(llm, plan, state, messages.slice(-6));
    plan = analysis.applied.plan;
    state = analysis.applied.state;

    const phase = phaseAt({
      elapsedSeconds: elapsed,
      engagement: state.engagement,
      openHighValueObjective: openHighValue(plan, state),
      extension: state.extension,
      memberShortOnTime: state.modes.memberShortOnTime,
    });
    state = bookkeep(state, phase, new Date().toISOString()).state;
    if (phases.at(-1) !== phase) phases.push(phase);

    const system = buildTurnPrompt({
      plan,
      state,
      phase,
      services,
      firstName: MEMBER.firstName,
      isFirstMemberTurn: exchanges === 1,
      minutesLeft: (1800 - elapsed) / 60,
    });
    const turn = await collect(llm.stream('turn', { system, messages, maxOutputTokens: 300 }));
    if (turn.ttftMs !== null) ttfts.push(turn.ttftMs);
    messages.push({ role: 'assistant', content: turn.text });
    logger.log(`[${persona}] INTERVIEWER (${phase}, ${turn.ttftMs ?? '?'} ms): ${turn.text}`);
  }

  const agentTurns = messages.filter((m) => m.role === 'assistant').map((m) => normalise(m.content));
  return {
    persona,
    exchanges,
    simulatedMinutes: Math.round(elapsed / 6) / 10,
    coverage: computeCoverage(plan, state),
    repeatedQuestions: agentTurns.length - new Set(agentTurns).size,
    phases,
    extension: state.extension,
    modes: state.modes,
    wrapUpDone: state.wrapUpDone,
    ttftMsP50: percentile(ttfts, 50),
    ttftMsP95: percentile(ttfts, 95),
  };
}

async function main(): Promise<void> {
  const i = process.argv.indexOf('--persona');
  const requested = i > -1 ? process.argv[i + 1] : 'all';
  const personas = requested === 'all' ? Object.keys(PERSONAS) : [requested];
  for (const p of personas) {
    if (!PERSONAS[p]) throw new Error(`Unknown persona "${p}". Use one of: ${Object.keys(PERSONAS).join(', ')}, all`);
  }
  const config = new InterviewConfig();
  if (!config.turn || !config.reasoning)
    throw new Error('Set INTERVIEW_TURN_* and INTERVIEW_REASONING_* (provider, model, API key) first.');
  const llm = new InterviewLlmService(config);
  for (const persona of personas) {
    const report = await simulate(llm, persona);
    logger.log(`REPORT ${JSON.stringify(report)}`);
  }
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
