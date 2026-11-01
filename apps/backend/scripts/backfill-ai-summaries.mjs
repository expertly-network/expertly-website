// One-off: regenerates the AI summary of every published article whose stored summary has fewer
// than 3 takeaways (older generations often returned a single sentence). Uses the compiled
// AiService.summarizeArticle, so the same prompt, retry and parsing apply as on publish. Each
// article is one paid LLM call (two at most when the first answer is still short).
//
// Usage (build first so dist/ is current):
//   cd apps/backend && pnpm build && node --env-file=.env scripts/backfill-ai-summaries.mjs [--dry-run] [--limit N]
import { createRequire } from 'node:module';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const { AiService } = require('../dist/apps/backend/src/ai/ai.service.js');

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
const MIN_POINTS = 3;

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  process.stderr.write('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.\n');
  process.exit(1);
}
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const points = (summary) => (summary ?? '').split('\n').filter((l) => l.trim()).length;
const log = (message) => process.stdout.write(`${dryRun ? '[dry-run] ' : ''}${message}\n`);

async function main() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('articles')
      .select('id, title, body, ai_summary')
      .eq('status', 'published')
      .order('created_at', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const targets = rows.filter((r) => points(r.ai_summary) < MIN_POINTS).slice(0, limit);
  log(`${rows.length} published articles, ${targets.length} to regenerate.`);
  if (dryRun) return;

  // The repository dependency is only used by draft generation, never by summarizeArticle.
  const ai = new AiService(null);
  let updated = 0;
  let failed = 0;
  for (const row of targets) {
    try {
      const summary = await ai.summarizeArticle(row.title, row.body);
      if (points(summary) <= points(row.ai_summary)) {
        log(`skipped ${row.id}: new summary not longer (${points(summary)} points)`);
        continue;
      }
      const { error } = await supabase.from('articles').update({ ai_summary: summary }).eq('id', row.id);
      if (error) throw error;
      updated++;
      log(`updated ${row.id} (${points(summary)} points)`);
    } catch (error) {
      failed++;
      log(`failed ${row.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  log(`done: ${updated} updated, ${failed} failed.`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : JSON.stringify(error)}\n`);
  process.exit(1);
});
