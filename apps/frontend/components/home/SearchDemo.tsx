'use client';

import { useEffect, useState } from 'react';
import type { SearchAppliedDto, SearchResponse } from '@shared/search';
import { SearchResults } from '@/components/search/SearchResults';

// The home page search panel's looping demo. A sample question types itself into the input's
// placeholder, the panel shows the search modal's own loading state, then the results render through
// the same SearchResults component as live search. The responses are sample SearchResponse payloads
// (illustrative people and content) shaped exactly like POST /v1/search returns them: the answer
// follows the backend's composeAnswer() wording, reasons are the judge's one-line phrases, and
// 'possible' matches sit under "You might also need".

export interface DemoScenario {
  query: string;
  response: SearchResponse;
}

function applied(partial: Partial<SearchAppliedDto>): SearchAppliedDto {
  return {
    types: ['member', 'article', 'event'],
    topic: null,
    countries: [],
    city: null,
    serviceIds: null,
    dateFrom: null,
    dateTo: null,
    maxHourlyRateUsd: null,
    relaxed: [],
    ...partial,
  };
}

export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    query: 'M&A tax advisor in Singapore under $500/hr',
    response: {
      logId: null,
      answer:
        'Best matches: Priya Krishnaswamy and Daniel Tan. Priya Krishnaswamy stands out — advises on tax structuring for cross-border acquisitions in Southeast Asia.',
      results: [
        {
          type: 'member',
          id: 'demo-m1',
          name: 'Priya Krishnaswamy',
          slug: 'demo',
          headline: 'Tax Partner, M&A',
          firm: null,
          location: 'Singapore',
          services: [],
          available: true,
          rate: null,
          match: { score: 9, label: 'strong', tier: 'best' },
          reason: 'advises on tax structuring for cross-border acquisitions in Southeast Asia',
        },
        {
          type: 'member',
          id: 'demo-m2',
          name: 'Daniel Tan',
          slug: 'demo',
          headline: 'M&A Tax Director',
          firm: null,
          location: 'Singapore',
          services: [],
          available: true,
          rate: null,
          match: { score: 7, label: 'good', tier: 'best' },
          reason: 'leads tax due diligence on inbound and outbound Singapore deals',
        },
        {
          type: 'article',
          id: 'demo-a1',
          title: 'Structuring cross-border M&A in Southeast Asia',
          slug: 'demo',
          excerpt: 'Holding structures, withholding tax and treaty access for regional deals.',
          countries: ['Singapore'],
          publishedAt: '2026-10-28T00:00:00Z',
          readTimeMinutes: 6,
          match: { score: 5, label: 'possible', tier: 'related' },
          reason: 'background reading on deal structures rather than an advisor',
        },
      ],
      applied: applied({ topic: 'M&A tax advice', countries: ['Singapore'], maxHourlyRateUsd: 500 }),
      degraded: [],
      ms: 2400,
    },
  },
  {
    query: 'Transfer pricing expert for a UAE subsidiary',
    response: {
      logId: null,
      answer:
        'Best matches: Omar Haddad and Leila Nasser. Omar Haddad stands out — prepares transfer pricing documentation for UAE free zone and mainland entities.',
      results: [
        {
          type: 'member',
          id: 'demo-m3',
          name: 'Omar Haddad',
          slug: 'demo',
          headline: 'Transfer Pricing Partner',
          firm: null,
          location: 'Dubai, United Arab Emirates',
          services: [],
          available: true,
          rate: null,
          match: { score: 9, label: 'strong', tier: 'best' },
          reason: 'prepares transfer pricing documentation for UAE free zone and mainland entities',
        },
        {
          type: 'member',
          id: 'demo-m4',
          name: 'Leila Nasser',
          slug: 'demo',
          headline: 'International Tax Director',
          firm: null,
          location: 'Abu Dhabi, United Arab Emirates',
          services: [],
          available: true,
          rate: null,
          match: { score: 8, label: 'strong', tier: 'best' },
          reason: 'benchmarks intra-group services and financing for UAE corporate tax',
        },
        {
          type: 'event',
          id: 'demo-e1',
          title: 'GCC Tax Forum',
          slug: 'demo',
          summary: null,
          startsAt: '2027-01-20T00:00:00Z',
          endsAt: null,
          location: 'Dubai',
          format: 'in_person',
          isFree: false,
          registrationUrl: null,
          match: { score: 5, label: 'possible', tier: 'related' },
          reason: 'regional tax conference with a transfer pricing track',
        },
      ],
      applied: applied({ topic: 'transfer pricing', countries: ['United Arab Emirates'] }),
      degraded: [],
      ms: 2100,
    },
  },
  {
    query: 'Who can help with a GST audit in India?',
    response: {
      logId: null,
      answer:
        'Best matches: Ananya Rao and Understanding the Recent GST Developments in India. Ananya Rao stands out — represents businesses in GST audits and responds to department notices.',
      results: [
        {
          type: 'member',
          id: 'demo-m5',
          name: 'Ananya Rao',
          slug: 'demo',
          headline: 'Indirect Tax Lead',
          firm: null,
          location: 'Mumbai, India',
          services: [],
          available: true,
          rate: null,
          match: { score: 9, label: 'strong', tier: 'best' },
          reason: 'represents businesses in GST audits and responds to department notices',
        },
        {
          type: 'article',
          id: 'demo-a2',
          title: 'Understanding the Recent GST Developments in India',
          slug: 'demo',
          excerpt: 'What the latest GST Council changes mean for compliance and audits.',
          countries: ['India'],
          publishedAt: '2026-10-30T00:00:00Z',
          readTimeMinutes: 5,
          match: { score: 7, label: 'good', tier: 'best' },
          reason: 'explains recent GST changes that auditors are checking',
        },
        {
          type: 'member',
          id: 'demo-m6',
          name: 'Vikram Mehta',
          slug: 'demo',
          headline: 'Indirect Tax Advisor',
          firm: null,
          location: 'Bengaluru, India',
          services: [],
          available: true,
          rate: null,
          match: { score: 5, label: 'possible', tier: 'related' },
          reason: 'handles GST registrations and returns rather than audits',
        },
      ],
      applied: applied({ topic: 'GST audit', countries: ['India'] }),
      degraded: [],
      ms: 2600,
    },
  },
];

// typing → loading → results → leaving → next scenario
export type DemoStage = 'typing' | 'loading' | 'results' | 'leaving';

const TYPE_MS = 26;
const AFTER_TYPE_MS = 250;
const LOADING_MS = 900;
const HOLD_MS = 5200;
const LEAVE_MS = 350;

/** Drives the loop. Returns the current scenario, how much of its query is typed, and the stage. */
export function useSearchDemo(paused: boolean, reducedMotion: boolean) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState(0);
  const [stage, setStage] = useState<DemoStage>('typing');
  const scenario = DEMO_SCENARIOS[index];

  useEffect(() => {
    if (reducedMotion) {
      setTyped(scenario.query.length);
      setStage('results');
      return;
    }
    if (paused) return;

    // Each run restarts the current scenario from an empty input.
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    setTyped(0);
    setStage('typing');

    const len = scenario.query.length;
    for (let i = 1; i <= len; i++) at(i * TYPE_MS, () => setTyped(i));
    let t = len * TYPE_MS + AFTER_TYPE_MS;
    at(t, () => setStage('loading'));
    t += LOADING_MS;
    at(t, () => setStage('results'));
    t += HOLD_MS;
    at(t, () => setStage('leaving'));
    t += LEAVE_MS;
    at(t, () => setIndex((i) => (i + 1) % DEMO_SCENARIOS.length));

    return () => timers.forEach(clearTimeout);
  }, [index, paused, reducedMotion, scenario]);

  return { index, scenario, typed, stage };
}

/** The panel body during the demo: the modal's loading state, then the real results layout. */
export function SearchDemoBody({
  index,
  scenario,
  stage,
}: {
  index: number;
  scenario: DemoScenario;
  stage: DemoStage;
}) {
  if (stage === 'typing') return null;
  if (stage === 'loading') {
    // Same as SearchModal's loading state.
    return (
      <div
        aria-hidden="true"
        className="flex h-full flex-col items-center justify-center gap-3 px-5 text-center text-sm text-ink-3"
      >
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-line-2 border-t-accent" />
        Searching the network…
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`sd-fade-bottom h-full overflow-hidden p-2 transition-opacity duration-300 ${stage === 'leaving' ? 'opacity-0' : 'opacity-100'}`}
    >
      <SearchResults key={index} response={scenario.response} query={scenario.query} preview />
    </div>
  );
}
