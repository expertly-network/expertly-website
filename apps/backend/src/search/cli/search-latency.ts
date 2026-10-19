import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { SearchModule } from '../search.module';
import { SearchService } from '../search.service';
import type { StageTimings } from '../search.types';

// `pnpm search:latency` — runs a few representative questions ONE AT A TIME (cold topic-embedding
// cache) and reports end-to-end and per-stage milliseconds. Calls OpenAI + the dev DB; writes nothing.

const QUESTIONS = [
  'members who specialize in M&A tax',
  'events in Singapore',
  'ESOP tax for foreign employees',
  'who has worked with Tata Motors',
  'members in Chennai who charge less than $200 per hour',
];

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SearchModule, { logger: ['error'] });
  const search = app.get(SearchService);
  const totals: number[] = [];
  const others: number[] = [];
  const stages: (keyof StageTimings)[] = ['planner', 'embedding', 'hybrid', 'judge'];
  const perStage: Record<keyof StageTimings, number[]> = { planner: [], embedding: [], hybrid: [], judge: [] };

  for (const q of QUESTIONS) {
    const t0 = Date.now();
    const out = await search.runSearch(q);
    const total = Date.now() - t0;
    totals.push(total);
    const t = out.debug.timings;
    for (const s of stages) perStage[s].push(t[s]);
    const other = total - stages.reduce((sum, s) => sum + t[s], 0);
    others.push(other);
    console.log(`${String(total).padStart(6)}ms  planner ${t.planner}  embedding ${t.embedding}  hybrid ${t.hybrid}  judge ${t.judge}  other ${other}  | ${q}${out.degraded.length ? ' [degraded ' + out.degraded.join(',') + ']' : ''}`);
  }
  console.log(`\nend-to-end   median ${median(totals)}ms   worst ${Math.max(...totals)}ms`);
  for (const s of stages) console.log(`${s.padEnd(12)} median ${median(perStage[s])}ms   worst ${Math.max(...perStage[s])}ms`);
  console.log(`other        median ${median(others)}ms   worst ${Math.max(...others)}ms   (service-term matching, cold start)`);
  await app.close();
}

void main();
