import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { OutboxService } from '../outbox.service';
import { SearchModule } from '../search.module';
import { SearchRepository, type StoredDocument } from '../search.repository';
import type { DocType, SearchCard } from '../card.types';

// READ-ONLY parity check: rebuilds every card in code and diffs it against the live
// search_documents rows. Writes nothing. Exit code 1 on any difference.

const sameTime = (a: string | null, b: string | null): boolean =>
  a === b || (a !== null && b !== null && new Date(a).getTime() === new Date(b).getTime());
const sameSet = (a: string[], b: string[]): boolean => a.length === b.length && a.every((v, i) => v === b[i]);

function firstDiff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const ctx = (s: string) => JSON.stringify(s.slice(Math.max(0, i - 30), i + 60));
  return `first difference at char ${i}\n      code: ${ctx(a)}\n      live: ${ctx(b)}`;
}

function compare(card: SearchCard, doc: StoredDocument): string[] {
  const out: string[] = [];
  const check = (field: string, ok: boolean, detail: () => string) => ok || out.push(`${field}: ${detail()}`);
  check('title', card.title === doc.title, () => `${JSON.stringify(card.title)} vs ${JSON.stringify(doc.title)}`);
  check('search_name', card.searchName === doc.search_name, () => `${JSON.stringify(card.searchName)} vs ${JSON.stringify(doc.search_name)}`);
  check('content', card.content === doc.content, () => firstDiff(card.content, doc.content));
  check('content_hash', card.contentHash === doc.content_hash, () => `${card.contentHash} vs ${doc.content_hash}`);
  check('service_ids', sameSet(card.serviceIds, doc.service_ids), () => `${card.serviceIds} vs ${doc.service_ids}`);
  check('countries', sameSet(card.countries, doc.countries), () => `${card.countries} vs ${doc.countries}`);
  check('city', card.city === doc.city, () => `${card.city} vs ${doc.city}`);
  check('event_start', sameTime(card.eventStart, doc.event_start), () => `${card.eventStart} vs ${doc.event_start}`);
  check('event_end', sameTime(card.eventEnd, doc.event_end), () => `${card.eventEnd} vs ${doc.event_end}`);
  check('rate_min_cents', card.rateMinCents === doc.rate_min_cents, () => `${card.rateMinCents} vs ${doc.rate_min_cents}`);
  check('rate_max_cents', card.rateMaxCents === doc.rate_max_cents, () => `${card.rateMaxCents} vs ${doc.rate_max_cents}`);
  check('is_available', card.isAvailable === doc.is_available, () => `${card.isAvailable} vs ${doc.is_available}`);
  check('doc_date', sameTime(card.docDate, doc.doc_date), () => `${card.docDate} vs ${doc.doc_date}`);
  return out;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SearchModule, { logger: ['error'] });
  const repo = app.get(SearchRepository);
  const outbox = app.get(OutboxService);

  const stored = new Map<string, StoredDocument>();
  for (const d of await repo.listDocuments()) stored.set(`${d.doc_type}:${d.source_id}`, d);

  const mismatches: string[] = [];
  let compared = 0;
  let expectedNoCard = 0;
  const seen = new Set<string>();

  for (const type of ['member', 'article', 'event'] as DocType[]) {
    for (const id of await repo.listSourceIds(type)) {
      const key = `${type}:${id}`;
      seen.add(key);
      const card = await outbox.buildCard(type, id);
      const doc = stored.get(key);
      if (!card) {
        if (doc) mismatches.push(`${key}: code builds NO card but a live document exists ("${doc.title}")`);
        else expectedNoCard++;
        continue;
      }
      if (!doc) {
        mismatches.push(`${key}: code builds a card ("${card.title}") but no live document exists`);
        continue;
      }
      compared++;
      const diffs = compare(card, doc);
      if (diffs.length) mismatches.push(`${key} ("${card.title}")\n    - ${diffs.join('\n    - ')}`);
    }
  }
  for (const [key, doc] of stored) {
    if (!seen.has(key)) mismatches.push(`${key}: live document ("${doc.title}") has no source record`);
  }

  console.log(`Live documents: ${stored.size}. Compared: ${compared}. Sources with no card (expected): ${expectedNoCard}.`);
  if (mismatches.length === 0) {
    console.log(`PARITY OK: 0 differences across ${compared} cards.`);
  } else {
    console.log(`PARITY FAILED: ${mismatches.length} mismatch(es):`);
    for (const m of mismatches) console.log(`  * ${m}`);
    process.exitCode = 1;
  }
  await app.close();
}

void main();
