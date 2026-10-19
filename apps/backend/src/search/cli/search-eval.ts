import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { checkCase, type EvalCase } from '../eval/eval-check';
import cases from '../eval/eval-cases.json';
import { SearchModule } from '../search.module';
import { SearchService } from '../search.service';
import { resultTitle } from '../search.types';

// `pnpm search:eval` — runs every active case in eval/eval-cases.json through the real pipeline
// (calls OpenAI and the dev database; writes nothing) and prints each FAILING case with its
// reason. Exit code 1 unless all cases pass.

const CONCURRENCY = 4;

interface CaseResult {
  c: EvalCase;
  passed: boolean;
  reason: string;
  returned: string[];
  answer: string;
  degraded: string[];
  ms: number;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SearchModule, { logger: ['error'] });
  const search = app.get(SearchService);
  const active = (cases as EvalCase[]).filter((c) => c.active).sort((a, b) => a.num - b.num);
  const results: CaseResult[] = [];

  for (let i = 0; i < active.length; i += CONCURRENCY) {
    const done = await Promise.all(
      active.slice(i, i + CONCURRENCY).map(async (c): Promise<CaseResult> => {
        const t0 = Date.now();
        try {
          const out = await search.runSearch(c.question);
          const verdict = checkCase(c, out);
          return {
            c, ...verdict, returned: out.results.map(resultTitle), answer: out.answer,
            degraded: out.degraded, ms: Date.now() - t0,
          };
        } catch (err) {
          return {
            c, passed: false, reason: 'error: ' + (err instanceof Error ? err.message : String(err)),
            returned: [], answer: '', degraded: [], ms: Date.now() - t0,
          };
        }
      })
    );
    results.push(...done);
  }

  for (const r of results) {
    const tag = r.degraded.length ? ` [degraded: ${r.degraded.join(',')}]` : '';
    console.log(`${r.passed ? 'PASS' : 'FAIL'}  #${r.c.num} ${r.c.question}  (${r.ms}ms)${tag}`);
    if (!r.passed) {
      console.log(`      reason:   ${r.reason}`);
      console.log(`      expected: ${r.c.kind}${r.c.expected.length ? ' ' + JSON.stringify(r.c.expected) : ''}${r.c.expectedCount != null ? ' count=' + r.c.expectedCount : ''}${r.c.minCount != null ? ' min=' + r.c.minCount : ''}`);
      console.log(`      returned: ${JSON.stringify(r.returned)}`);
      console.log(`      answer:   ${r.answer}`);
    }
  }
  const passed = results.filter((r) => r.passed).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (passed !== results.length) process.exitCode = 1;
  await app.close();
}

void main();
