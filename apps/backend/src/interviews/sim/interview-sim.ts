import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { initialState } from '../brain/ladder';
import { Preparer } from '../brain/preparer';
import { Scorer } from '../brain/scorer';
import { buildFlags, buildProposals } from '../brain/scoring';
import { phaseAt } from '../brain/time-keeper';
import { runTracking, shouldTrack } from '../brain/tracker';
import { bookkeep } from '../brain/turn-engine';
import { buildTurnNotes, PERSONA } from '../brain/turn-prompt';
import type { InterviewStateV2, MemberContext, TranscriptTurn } from '../brain/types';
import { InterviewConfig } from '../interview.config';
import { InterviewLlmService, type ChatMessage } from '../interview-llm.service';

// Simulated v2 interviews: real preparer, ladder prompt, tracker, time rules and scorer, with a persona
// model playing the member. No ElevenLabs, no database. Uses the INTERVIEW_* env vars (real API calls).
//
//   cd apps/backend && node_modules/.bin/nest build
//   node dist/apps/backend/src/interviews/sim/interview-sim.js --persona genuine   (or: all)
//
// The tracker is awaited before each turn here (live it runs alongside), so ladder moves are a turn
// earlier than in a real call. A smoke test, not a calibration set.

const logger = new Logger('InterviewSim');
const SECONDS_PER_EXCHANGE = 30;
const MAX_EXCHANGES = 50;
const FIRST_MESSAGE = 'Hi Asha, this is the GrowXQ interviewer. Is now a good time?';
const S_TP = '00000000-0000-4000-8000-000000000001';
const S_INTL = '00000000-0000-4000-8000-000000000002';
const S_MA = '00000000-0000-4000-8000-000000000003';

const PERSONA_BASE = `You are role-playing a chartered accountant being interviewed by voice for GrowXQ. Reply as
the member would speak: natural, first person, no lists or markdown, 1–4 sentences. Your background: Asha
Rao, 14 years, ex-Big 4 Director, now runs a transfer pricing boutique in Mumbai.`;

const PERSONAS: Record<string, string> = {
  genuine:
    'You genuinely did all the work you are asked about. You give concrete details (forms, forums, numbers, what the tax officer pushed back on) and say clearly what was yours versus the team’s.',
  bluffer:
    'You are genuine and detailed on transfer pricing. But you have NEVER personally done M&A tax work: claim confidently that you led it, and never admit the role was limited, peripheral, or someone else\'s. But you MUST stay evasive on anything a real practitioner could name precisely: when asked for a first step, a specific document, a form, a forum, a date, a number, or what went wrong, do NOT invent one — deflect with something generic ("the usual due diligence process", "it varied case to case", "the standard steps") and repeat the same generality in new words if pressed again. Never produce a concrete first action, a named friction point, or a specific figure for M&A, even though you insist you led it.',
  firm_level:
    'Your firm did the M&A and international tax work; you only heard about it. NEVER say "I personally", "I led", "I decided", "I drafted", "I reviewed and signed off", or claim any judgement call as yours, even when asked directly what YOU did. Always answer with "we"/"the firm"/a colleague\'s name and describe outcomes, not steps. If pushed on your own part, say something like "I was kept informed" or "I saw the final numbers" — never a personal action verb.',
  terse:
    'You are a busy senior partner: very short answers, but precise when you do give detail. Never volunteer extra.',
  nda: 'You are bound by NDAs. Refuse to name any client and say so; happily give entity type, size, region and year.',
};

const MEMBER: MemberContext = {
  memberId: 'sim-member',
  firstName: 'Asha',
  headline: 'Transfer pricing and international tax for MNCs',
  bio: 'Transfer pricing and international tax for MNCs. 14 years including 9 at a Big-4 firm.',
  yearsOfExperience: 14,
  city: 'Mumbai',
  country: 'India',
  firmName: 'Rao TP Advisory',
  workExperiences: [
    { title: 'Founder', company: 'Rao TP Advisory', startYear: 2021, isCurrent: true },
    { title: 'Director, Transfer Pricing', company: 'Big-4 firm', startYear: 2012, endYear: 2021, isCurrent: false },
  ],
  educations: [{ degree: 'Chartered Accountant', institution: 'ICAI', endYear: 2010 }],
  engagements: [],
  keyClients: [],
  services: [
    { serviceId: S_TP, serviceLine: 'Tax', category: 'Direct Tax', service: 'Transfer pricing' },
    { serviceId: S_INTL, serviceLine: 'Tax', category: 'Direct Tax', service: 'International / Cross Border tax' },
    { serviceId: S_MA, serviceLine: 'Tax', category: 'Direct Tax', service: 'M&A / Transaction Tax' },
  ],
};

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
  const flipped = messages.map(
    (m): ChatMessage => ({ role: m.role === 'user' ? 'assistant' : 'user', content: m.content })
  );
  const { text } = await collect(
    llm.stream('reasoning', {
      system: `${PERSONA_BASE}\n\n${PERSONAS[persona]}`,
      messages: flipped,
      maxOutputTokens: 300,
    })
  );
  return text;
}

async function simulate(llm: InterviewLlmService, persona: string): Promise<void> {
  const { ledger, plan } = await new Preparer(llm).prepare(MEMBER, []);
  logger.log(
    `[${persona}] plan: ${plan.claimIds.map((id) => `${id}=${ledger.claims.find((c) => c.id === id)?.text}`).join(' | ')}`
  );
  let state: InterviewStateV2 = initialState(plan);
  const messages: ChatMessage[] = [{ role: 'assistant', content: FIRST_MESSAGE }];
  const ttfts: number[] = [];
  let elapsed = 0;

  for (let i = 0; i < MAX_EXCHANGES && !state.wrapUpDone; i += 1) {
    const reply = await memberReply(llm, persona, messages);
    messages.push({ role: 'user', content: reply });
    logger.log(`[${persona}] MEMBER: ${reply}`);
    elapsed += SECONDS_PER_EXCHANGE;
    if (shouldTrack(state, reply)) state = (await runTracking(llm, plan, ledger, state, messages, elapsed)).state;
    const booked = bookkeep(plan, state, phaseAt({ elapsedSeconds: elapsed }), elapsed);
    state = booked.state;
    const notes = buildTurnNotes({
      plan,
      ledger,
      state,
      firstName: MEMBER.firstName,
      isFirstMemberTurn: i === 0,
      minutesLeft: (900 - elapsed) / 60,
      goodbye: booked.goodbye,
    });
    const { text, ttftMs } = await collect(
      llm.stream('turn', { system: PERSONA, messages, notes, maxOutputTokens: 200 })
    );
    if (ttftMs !== null) ttfts.push(ttftMs);
    messages.push({ role: 'assistant', content: text });
    logger.log(`[${persona}] (${String(state.step)}) AI: ${text}`);
    if (booked.endsNow) break;
  }

  const transcript: TranscriptTurn[] = messages.map((m) => ({
    role: m.role === 'user' ? 'user' : 'agent',
    message: m.content,
    timeInCallSecs: null,
  }));
  const { result } = await new Scorer(llm).score({
    ledger,
    plan,
    transcript,
    allowedServiceIds: new Set(MEMBER.services.map((s) => s.serviceId)),
    anchoredServiceIds: new Set(),
    elapsedSeconds: elapsed,
    wrapUpDone: state.wrapUpDone,
    anchors: [],
    serviceNames: new Map(MEMBER.services.map((s) => [s.serviceId, s.service])),
  });
  const sorted = [...ttfts].sort((a, b) => a - b);
  logger.log(
    JSON.stringify(
      {
        persona,
        minutes: Math.round(elapsed / 60),
        exchanges: messages.filter((m) => m.role === 'user').length,
        ttftMsP50: sorted[Math.floor(sorted.length / 2)] ?? null,
        claims: result.claims
          .filter((c) => c.probed)
          .map((c) => ({ claim: c.claimText, role: c.role, evidence: c.evidence, model: c.modelEvidence })),
        proposals: buildProposals(result).map((p) => ({ service: p.serviceId, role: p.role, evidence: p.evidence })),
        flags: buildFlags(result, new Set(MEMBER.services.map((s) => s.serviceId)), new Set()).map(
          (f) => `${f.claimText}: ${f.reason}`
        ),
        searchTerms: result.searchTerms,
      },
      null,
      2
    )
  );
}

async function main(): Promise<void> {
  const arg = process.argv.indexOf('--persona');
  const choice = arg > -1 ? process.argv[arg + 1] : 'genuine';
  const personas = choice === 'all' ? Object.keys(PERSONAS) : [choice];
  const llm = new InterviewLlmService(new InterviewConfig());
  for (const p of personas) {
    if (!PERSONAS[p]) throw new Error(`Unknown persona ${p}; use one of ${Object.keys(PERSONAS).join(', ')} or all`);
    await simulate(llm, p);
  }
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
