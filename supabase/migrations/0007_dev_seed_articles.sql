-- ============================================================================
-- DEV-ONLY SEED DATA — 9 published articles, for locally testing GET /v1/articles,
-- GET /v1/articles/:id, and the homepage's Latest Articles / member profile Articles tab
-- against real data.
--
-- Same status as 0005_dev_seed_members.sql / 0006_dev_seed_events.sql: not part of the
-- pre-production single-schema convention (supabase/migrations/README.md) — a deliberate
-- one-off exception, apply/tear down manually, never against production.
--
-- Content is genuinely written per article (not the design prototype's generic filler body —
-- see docs/database-erd.md's "Design decisions" note on why), one topic per real practice_areas
-- row, each attributed to a seeded member (0005) whose own practiceAreas/country genuinely match
-- the article's subject and byline location. `slug` is hand-computed here the same way
-- ArticlesService.generateUniqueSlug() would (kebab-case title, no collisions in this set).
--
-- Apply: `psql "$DATABASE_URL" -f supabase/migrations/0007_dev_seed_articles.sql`
-- Idempotent: re-running is safe — `on conflict (slug) do nothing`.
-- ============================================================================

-- `ai_summary` — 3 newline-separated bullet points per article, genuinely written from that
-- article's own body (not the design prototype's category-generic filler — see this file's own
-- header note on why). Frontend splits on '\n' to render the AI Summary green box's bullet list;
-- there is no real LLM call behind it (see docs/rest-api.md's "not built yet" note).
insert into public.articles (
  slug, author_id, status, title, body, excerpt, read_time_minutes, cover_image_url,
  practice_area_ids, country, created_at, updated_at, ai_summary
)
select
  v.slug,
  p.id,
  'published'::article_status,
  v.title,
  v.body,
  v.excerpt,
  v.read_time_minutes,
  v.cover_image_url,
  (select array_agg(pa.id) from public.practice_areas pa where pa.name = any(v.practice_area_names)),
  v.country,
  v.created_at,
  v.created_at,
  v.ai_summary
from (values

('navigating-indirect-tax-on-cross-border-digital-services',
 'Hiro Harrington',
 'Navigating Indirect Tax on Cross-Border Digital Services',
 $b1$<p>Digital services have outgrown the indirect tax frameworks most jurisdictions built for goods. A subscription sold from Singapore to a customer in Berlin, hosted on infrastructure in Ireland, and paid through a card processor in the US can trigger registration obligations in three or four places at once — and the rules for which place gets to tax it are still being written in real time.</p>
<h2>Where the friction actually shows up</h2>
<p>Most disputes we see are not about whether tax is owed at all — it almost always is somewhere — but about <strong>where</strong> the liability lands and who is responsible for collecting it. Marketplace facilitator rules now shift collection duty onto platforms in a growing number of jurisdictions, which is good news for individual sellers but creates its own registration and reconciliation burden for the platforms themselves.</p>
<ul>
<li>Determine the customer's location using at least two independent data points, not just billing address</li>
<li>Track registration thresholds separately per jurisdiction — they are rarely aligned</li>
<li>Build invoicing that can show the applicable rate and jurisdiction basis on request, not just after the fact</li>
</ul>
<p>The practical fix is rarely a single global system. It is a small number of well-documented regional rulesets, reviewed on a fixed cadence, with clear ownership for who updates them when a rate or threshold changes. Businesses that treat this as a one-time compliance project rather than an ongoing operational function are the ones we see get caught out.</p>
<p>For finance teams expanding into new markets, the single highest-leverage step is engaging local indirect tax counsel before the first sale closes, not after the first notice arrives.</p>$b1$,
 'Digital services have outgrown the indirect tax frameworks most jurisdictions built for goods, and the disputes we see are rarely about whether tax is owed — it is about where.',
 3,
 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=70',
 array['Indirect Tax'],
 'Singapore',
 timestamptz '2026-08-20 09:00:00+00',
 $s1$Digital services now trigger indirect tax obligations in multiple jurisdictions simultaneously — the real dispute is where liability lands, not whether tax is owed.
Marketplace facilitator rules increasingly shift collection duty onto platforms, easing the burden on individual sellers but adding registration complexity for the platforms themselves.
Treat compliance as an ongoing operational function with clear ownership, not a one-time project, and engage local counsel before the first sale closes, not after the first notice arrives.$s1$),

('the-new-rules-of-cross-border-ma-due-diligence',
 'Arjun Gupta',
 'The New Rules of Cross-Border M&A Due Diligence',
 $b2$<p>Due diligence used to be a checklist exercise: confirm the numbers, confirm the contracts, confirm there is nothing buried in a subsidiary nobody mentioned on the call. That checklist still matters, but it is no longer sufficient on its own for a cross-border transaction in 2026.</p>
<h2>What has actually changed</h2>
<p>Regulatory regimes are moving faster than deal timelines. Foreign direct investment screening, sanctions exposure, and sector-specific approval requirements can now materially change between signing and closing on a six-month deal, particularly in technology, infrastructure, and financial services targets. A clean diligence report at signing is no longer a guarantee of a clean close.</p>
<blockquote>The teams that get burned are the ones that treat regulatory review as a closing condition to tick off, rather than a live risk to monitor through to completion.</blockquote>
<p>We now build a standing regulatory-watch function into every cross-border mandate above a certain size — a short, recurring check-in specifically on anything that has shifted since signing, separate from the main deal team's workstream. It is a small addition to the budget that has repeatedly paid for itself.</p>
<h2>The dispute layer</h2>
<p>Where diligence genuinely falls short is in anticipating post-closing disputes. Warranty and indemnity claims increasingly turn on data room completeness rather than the substance of what was disclosed — a document technically present but buried three folders deep in a poorly indexed room has, in more than one matter we have advised on, been treated as effectively undisclosed by an arbitral tribunal. Indexing discipline is no longer a housekeeping matter; it is a liability control.</p>
<p>The playbook for 2026 is not more diligence. It is diligence that keeps running after signing, and a data room built to survive being read by someone hostile two years later.</p>$b2$,
 'Regulatory regimes now move faster than deal timelines, and a clean diligence report at signing is no longer a guarantee of a clean close.',
 4,
 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1200&q=70',
 array['M&A Tax', 'Dispute Resolution'],
 'Germany',
 timestamptz '2026-08-10 09:00:00+00',
 $s2$Regulatory regimes now move faster than deal timelines, so a clean diligence report at signing no longer guarantees a clean close.
A standing regulatory-watch function running through to completion catches shifts in FDI screening, sanctions, and sector approvals that emerge after signing.
Data room indexing discipline is now a liability control — a document buried too deep has been treated as effectively undisclosed by an arbitral tribunal.$s2$),

('corporate-law-considerations-in-post-merger-integration',
 'Zara Schmidt',
 'Corporate Law Considerations in Post-Merger Integration',
 $b3$<p>Signing and closing get most of the attention in a merger, but the legal work that determines whether a deal actually creates value happens afterward, during integration — and it is where we see the most avoidable value destruction.</p>
<h2>Contracts do not merge themselves</h2>
<p>Every material contract the target holds needs to be reviewed for change-of-control clauses, assignment restrictions, and most-favoured-terms provisions that a combined entity might now trigger. This is tedious, unglamorous work, and it is routinely under-resourced relative to how much value sits inside it — a single key supplier agreement with an unnoticed change-of-control termination right has ended more than one otherwise well-executed integration.</p>
<ul>
<li>Re-paper employment terms jurisdiction by jurisdiction — harmonising too quickly across borders creates its own exposure</li>
<li>Consolidate corporate governance structures on a realistic timeline, not an aspirational one</li>
<li>Treat data protection and IP assignment as day-one priorities, not quarter-two cleanup items</li>
</ul>
<h2>Governance during the transition</h2>
<p>The period between close and full integration is where governance ambiguity does the most damage. Decision rights, signing authority, and reporting lines should be documented explicitly and communicated before day one, not worked out informally as questions arise. Ambiguity here is cheap to prevent and expensive to unwind once informal practices have taken root.</p>
<p>The firms that integrate well treat the corporate law workstream as a genuine deliverable with its own timeline and owner, not an afterthought bolted onto the operational integration plan.</p>$b3$,
 'The legal work that determines whether a merger actually creates value happens after closing, during integration — and it is routinely under-resourced.',
 3,
 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1200&q=70',
 array['Corporate Law', 'Restructuring'],
 'United Kingdom',
 timestamptz '2026-07-28 09:00:00+00',
 $s3$The legal work that determines whether a merger actually creates value happens during integration, not at signing or closing.
Every material contract needs review for change-of-control and assignment clauses — one missed supplier termination right can derail an otherwise clean deal.
Document decision rights, signing authority, and reporting lines explicitly before day one; governance ambiguity is cheap to prevent and expensive to unwind.$s3$),

('transfer-pricing-documentation-what-regulators-are-really-looking-for',
 'Amara Bianchi',
 'Transfer Pricing Documentation: What Regulators Are Really Looking For',
 $b4$<p>Most transfer pricing documentation is written to satisfy a filing requirement. The documentation that actually survives an audit is written to satisfy a specific, skeptical reader — and those are not the same document.</p>
<h2>The gap between compliant and convincing</h2>
<p>A local file that mechanically restates the group's transfer pricing policy without connecting it to the entity's actual functions, assets, and risks will technically satisfy most filing requirements and will still fail under real scrutiny. Auditors increasingly cross-reference documentation against unrelated filings — customs declarations, VAT returns, even job postings — looking for inconsistencies in how a business describes its own operations.</p>
<p><em>The single most common finding we see in audits is not a wrong benchmark. It is a functional description that does not match reality on the ground.</em></p>
<ul>
<li>Functional analysis should be re-validated annually against what the business actually does, not copied forward from last year's file</li>
<li>Benchmarking sets need documented rejection criteria, not just accepted comparables</li>
<li>Intercompany agreements should be dated and executed contemporaneously with the arrangements they describe, not drafted retrospectively to match a completed benchmarking study</li>
</ul>
<h2>Where Pillar Two changes the calculus</h2>
<p>Effective tax rate calculations under Pillar Two now interact directly with transfer pricing outcomes in ways that most groups' documentation processes were not originally designed to capture. A pricing adjustment that looked immaterial under the old regime can now move a jurisdiction's effective rate meaningfully. Documentation and Pillar Two compliance can no longer be run as separate workstreams by separate teams without real coordination.</p>
<p>Good documentation is not a compliance artifact. It is the record of a defensible business decision, written for the person who will eventually try to pick it apart.</p>$b4$,
 'The documentation that survives an audit is written for a specific, skeptical reader — and that is not the same document most groups actually produce.',
 3,
 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=70',
 array['Transfer Pricing'],
 'India',
 timestamptz '2026-07-15 09:00:00+00',
 $s4$Documentation that merely satisfies filing requirements often fails real audit scrutiny — auditors cross-reference it against customs filings, VAT returns, even job postings.
Functional analysis should be re-validated annually against actual operations, not copied forward, and benchmarking sets need documented rejection criteria.
Pillar Two now interacts directly with transfer pricing outcomes, so documentation and Pillar Two compliance can no longer run as separate, uncoordinated workstreams.$s4$),

('ip-licensing-in-an-ai-first-world',
 'Oliver Devereux',
 'IP Licensing in an AI-First World',
 $b5$<p>Licensing agreements written even three years ago rarely anticipated that the licensed content or technology might end up training a model rather than being used directly by a human licensee. That gap is now the single most contested clause in technology licensing negotiations.</p>
<h2>The clauses that need rewriting</h2>
<p>"Use" in most legacy licenses was defined around direct consumption or integration — displaying content, running software, embedding an API response. It was not written with machine-learning training, fine-tuning, or output generation in mind, and courts in several jurisdictions have been asked in the last two years to decide whether those older definitions extend to cover it. The answers have not been consistent.</p>
<ul>
<li>Define "training use" and "inference use" as distinct, separately licensable rights, not a single undifferentiated grant</li>
<li>Address output ownership explicitly — who owns content a model generates after being trained on or fine-tuned with the licensed material</li>
<li>Build in audit rights specific to model training pipelines, which existing audit clauses drafted for traditional software rarely cover</li>
</ul>
<h2>Negotiating from either side</h2>
<p>Licensors are increasingly pricing training rights as a separate, premium tier distinct from standard commercial use — a trend we expect to continue as the value of high-quality training data becomes more explicit to both sides of the table. Licensees, in turn, are pushing for indemnification specifically against downstream infringement claims arising from model outputs, a risk category that barely existed in standard licensing playbooks before 2024.</p>
<p>Any technology license renewed or newly drafted this year should be reviewed with these questions asked explicitly, rather than assumed to be covered by boilerplate written for a pre-AI licensing landscape.</p>$b5$,
 'Licensing agreements written even three years ago rarely anticipated that content might end up training a model rather than being used directly — that gap is now the most contested clause in the room.',
 3,
 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=70',
 array['IP & Technology'],
 'United Arab Emirates',
 timestamptz '2026-07-02 09:00:00+00',
 $s5$Legacy licenses rarely anticipated licensed content training a model rather than being used directly — this is now the most contested clause in tech licensing.
"Training use" and "inference use" should be defined as distinct, separately licensable rights, with output ownership addressed explicitly.
Licensors are pricing training rights as a premium tier, while licensees push for indemnification against downstream infringement claims from model outputs.$s5$),

('antitrust-risk-in-cross-border-bank-mergers',
 'Meera Nair',
 'Antitrust Risk in Cross-Border Bank Mergers',
 $b6$<p>Bank mergers have always drawn antitrust scrutiny, but the scope of that scrutiny has widened. Regulators are no longer looking only at retail deposit market share in overlapping branch footprints — they are increasingly examining concentration in specific commercial lending segments, payments infrastructure, and even data-sharing arrangements that emerge post-merger.</p>
<h2>Multi-jurisdiction review is no longer optional planning</h2>
<p>A merger between two banks with meaningful cross-border operations can now trigger substantive review in every jurisdiction where either party holds material market share, not just where the combined entity will be headquartered. Timelines across these reviews rarely align, and a clearance in one jurisdiction carries no weight in another's independent analysis.</p>
<blockquote>The deals that stall are rarely the ones regulators object to outright. They are the ones where the parties did not plan for review timelines to diverge by six months or more across jurisdictions.</blockquote>
<p>Remedies packages also increasingly need to be jurisdiction-specific rather than global. A branch divestiture that satisfies one regulator's concentration concerns may do nothing to address a different regulator's specific worry about small-business lending concentration in a particular region.</p>
<ul>
<li>Map every jurisdiction where either party has material share before signing, not after first regulatory contact</li>
<li>Build remedies optionality into the deal structure from the start rather than negotiating it reactively</li>
<li>Treat payments and data infrastructure overlap as its own review category, separate from traditional deposit and lending market analysis</li>
</ul>
<p>The banks that navigate this well start their antitrust strategy at the term sheet stage, not after the first regulator raises a question.</p>$b6$,
 'Regulators are no longer looking only at retail deposit share — commercial lending concentration and payments infrastructure overlap are now squarely in scope too.',
 3,
 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?auto=format&fit=crop&w=1200&q=70',
 array['Antitrust', 'Banking & Finance'],
 'United States',
 timestamptz '2026-06-20 09:00:00+00',
 $s6$Regulatory scrutiny now extends beyond retail deposit share to commercial lending concentration, payments infrastructure, and post-merger data-sharing arrangements.
A merger can trigger substantive review in every jurisdiction where either party holds material share, with review timelines rarely aligning across regulators.
Remedies packages need to be jurisdiction-specific — map every relevant market and build remedies optionality into the deal structure from the start, not reactively.$s6$),

('private-equity-exit-strategies-in-a-higher-rate-environment',
 'Noah Muller',
 'Private Equity Exit Strategies in a Higher-Rate Environment',
 $b7$<p>Exit timelines that were built assuming financing costs would normalise downward have needed real rethinking. Sponsors holding assets acquired at pre-2023 leverage assumptions are finding that the arithmetic on a straightforward sale to a strategic or another fund no longer closes the way it used to.</p>
<h2>Where the exit market has actually shifted</h2>
<p>Strategic buyers with strong balance sheets have become relatively more attractive counterparties than leveraged financial buyers for assets where debt-funded returns are harder to underwrite at current rates. Continuation vehicles, once a niche tool for a handful of trophy assets, have become a mainstream option for extending hold periods on fundamentally sound portfolio companies without forcing a sale into an unfavourable market.</p>
<ul>
<li>Dual-track processes — running a sale process alongside continuation-vehicle preparation — are increasingly standard rather than exceptional</li>
<li>Earnout structures are being used more aggressively to bridge valuation gaps between buyer and seller expectations</li>
<li>Operational value creation, not multiple expansion, is carrying more of the return thesis on newer vintage deals</li>
</ul>
<h2>What LPs are actually asking for</h2>
<p>Limited partners are pushing harder for exit optionality to be built into fund terms from the outset rather than negotiated deal-by-deal as market conditions shift. That pressure is filtering into how GPs structure new fund vehicles, with more explicit continuation-vehicle governance terms appearing in fund documents at formation rather than being bolted on later.</p>
<p>The sponsors performing best in this environment are the ones treating exit planning as a live, continuously revisited workstream from acquisition onward, not a process that only starts eighteen months before a targeted sale.</p>$b7$,
 'Sponsors holding assets acquired at pre-2023 leverage assumptions are finding the arithmetic on a straightforward sale no longer closes the way it used to.',
 3,
 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=70',
 array['Private Equity'],
 'Singapore',
 timestamptz '2026-06-05 09:00:00+00',
 $s7$Exit timelines built on pre-2023 leverage assumptions no longer close the way they used to under current financing costs.
Continuation vehicles have moved from a niche tool for trophy assets to a mainstream option for extending holds on fundamentally sound portfolio companies.
Dual-track processes and more aggressive earnout structures are becoming standard as operational value creation, not multiple expansion, carries the return thesis.$s7$),

('restructuring-distressed-assets-lessons-from-recent-cross-border-insolvencies',
 'Grace Lindqvist',
 'Restructuring Distressed Assets: Lessons from Recent Cross-Border Insolvencies',
 $b8$<p>Cross-border insolvencies rarely fail because of a single bad decision. They fail because a restructuring plan built around one jurisdiction's legal assumptions runs headlong into a second jurisdiction's creditor priority rules midway through implementation.</p>
<h2>Recognition is not a formality</h2>
<p>Getting a restructuring plan or scheme recognised in every jurisdiction where the debtor has meaningful assets or creditors needs to happen early, not as a late-stage administrative step. We have seen well-negotiated schemes unwind entirely because recognition proceedings in a secondary jurisdiction took longer than the implementation timeline allowed for, giving dissenting creditors room to act before the plan became binding there.</p>
<blockquote>The plans that hold together are the ones where recognition strategy was treated as core deal work from week one, not handed to local counsel as a formality once the main terms were agreed.</blockquote>
<p>Priority of claims is the other recurring flashpoint. A creditor class treated as senior under the debtor's home jurisdiction's law may rank differently — or not be recognised as a distinct class at all — under a secondary jurisdiction's insolvency framework. Getting independent local advice on priority early prevents a scheme from being renegotiated under pressure once a creditor group discovers a more favourable position available to them elsewhere.</p>
<ul>
<li>Map creditor priority under every relevant jurisdiction's law before finalising plan terms, not after objections surface</li>
<li>Sequence recognition filings to run in parallel with negotiation, not after terms are settled</li>
<li>Assume dissenting creditors will look for jurisdiction arbitrage opportunities, and close the obvious ones proactively</li>
</ul>
<p>The through-line across the restructurings that held together well is simple: treat cross-border complexity as the central design constraint of the plan, not a risk to be managed around it after the fact.</p>$b8$,
 'Cross-border insolvencies rarely fail because of one bad decision — they fail when a plan built around one jurisdiction runs into another jurisdiction''s creditor priority rules midway through.',
 4,
 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=70',
 array['Restructuring', 'Corporate Law'],
 'South Africa',
 timestamptz '2026-05-22 09:00:00+00',
 $s8$Cross-border insolvencies fail when a plan built around one jurisdiction's assumptions collides with another jurisdiction's creditor priority rules mid-implementation.
Recognition of a restructuring plan in every relevant jurisdiction needs to start in week one, not as a late-stage administrative step.
Map creditor priority under every relevant jurisdiction's law before finalising terms, and sequence recognition filings to run in parallel with negotiation.$s8$),

('capital-markets-compliance-after-the-latest-disclosure-reforms',
 'Kavya Rao',
 'Capital Markets Compliance After the Latest Disclosure Reforms',
 $b9$<p>Disclosure obligations for listed issuers have expanded meaningfully over the past two cycles, and compliance functions built for the previous regime are now visibly strained. The gap is not usually in understanding what needs to be disclosed — it is in building the internal processes fast enough to actually produce it on schedule.</p>
<h2>Where the real burden landed</h2>
<p>Expanded climate and supply-chain disclosure requirements pull data from operational teams that have historically had no relationship with investor relations or legal, and building that data pipeline from scratch under a compliance deadline is where most issuers are losing time. The technical disclosure requirement is rarely the hard part; the internal data-collection workflow is.</p>
<ul>
<li>Assign clear ownership for each new disclosure category to a specific internal function, not "compliance" generically</li>
<li>Build data collection processes with a full quarter of buffer before the first mandatory filing under a new requirement</li>
<li>Treat materiality assessments as living documents reviewed each cycle, not a one-time determination made at adoption</li>
</ul>
<h2>The enforcement pattern to watch</h2>
<p>Early enforcement action under the newer disclosure regimes has focused disproportionately on inconsistency between what issuers disclose in regulatory filings and what they say in investor-facing materials, rather than on the underlying disclosure gaps themselves. A materiality determination that looks reasonable in isolation can still draw scrutiny if it contradicts language used in an earnings call or investor deck from the same period.</p>
<p>Issuers that are managing this well have brought legal, investor relations, and the operational data owners into a single review cycle for every disclosure period, rather than running each function's sign-off as a separate, sequential step.</p>$b9$,
 'The technical disclosure requirement is rarely the hard part — the internal data-collection workflow fast enough to actually meet the deadline is where most issuers are losing time.',
 3,
 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=70',
 array['Capital Markets', 'Compliance'],
 'Japan',
 timestamptz '2026-05-08 09:00:00+00',
 $s9$Expanded disclosure requirements are straining compliance less on understanding what to disclose and more on building the process to actually produce it on schedule.
Assign clear ownership for each new disclosure category to a specific internal function, with a full quarter of buffer before the first mandatory filing.
Early enforcement has focused on inconsistency between regulatory filings and investor-facing materials — align legal, investor relations, and data owners in one review cycle.$s9$)

) as v(slug, author_name, title, body, excerpt, read_time_minutes, cover_image_url, practice_area_names, country, created_at, ai_summary)
join public.profiles p on p.first_name || ' ' || p.last_name = v.author_name
on conflict (slug) do nothing;

-- Backfill for the case this migration was already applied before `ai_summary` was added above
-- (`on conflict do nothing` skips existing rows entirely) — safe to re-run, only touches rows
-- that are still missing it.
update public.articles a
set ai_summary = v.ai_summary
from (values
('navigating-indirect-tax-on-cross-border-digital-services', $s1$Digital services now trigger indirect tax obligations in multiple jurisdictions simultaneously — the real dispute is where liability lands, not whether tax is owed.
Marketplace facilitator rules increasingly shift collection duty onto platforms, easing the burden on individual sellers but adding registration complexity for the platforms themselves.
Treat compliance as an ongoing operational function with clear ownership, not a one-time project, and engage local counsel before the first sale closes, not after the first notice arrives.$s1$),
('the-new-rules-of-cross-border-ma-due-diligence', $s2$Regulatory regimes now move faster than deal timelines, so a clean diligence report at signing no longer guarantees a clean close.
A standing regulatory-watch function running through to completion catches shifts in FDI screening, sanctions, and sector approvals that emerge after signing.
Data room indexing discipline is now a liability control — a document buried too deep has been treated as effectively undisclosed by an arbitral tribunal.$s2$),
('corporate-law-considerations-in-post-merger-integration', $s3$The legal work that determines whether a merger actually creates value happens during integration, not at signing or closing.
Every material contract needs review for change-of-control and assignment clauses — one missed supplier termination right can derail an otherwise clean deal.
Document decision rights, signing authority, and reporting lines explicitly before day one; governance ambiguity is cheap to prevent and expensive to unwind.$s3$),
('transfer-pricing-documentation-what-regulators-are-really-looking-for', $s4$Documentation that merely satisfies filing requirements often fails real audit scrutiny — auditors cross-reference it against customs filings, VAT returns, even job postings.
Functional analysis should be re-validated annually against actual operations, not copied forward, and benchmarking sets need documented rejection criteria.
Pillar Two now interacts directly with transfer pricing outcomes, so documentation and Pillar Two compliance can no longer run as separate, uncoordinated workstreams.$s4$),
('ip-licensing-in-an-ai-first-world', $s5$Legacy licenses rarely anticipated licensed content training a model rather than being used directly — this is now the most contested clause in tech licensing.
"Training use" and "inference use" should be defined as distinct, separately licensable rights, with output ownership addressed explicitly.
Licensors are pricing training rights as a premium tier, while licensees push for indemnification against downstream infringement claims from model outputs.$s5$),
('antitrust-risk-in-cross-border-bank-mergers', $s6$Regulatory scrutiny now extends beyond retail deposit share to commercial lending concentration, payments infrastructure, and post-merger data-sharing arrangements.
A merger can trigger substantive review in every jurisdiction where either party holds material share, with review timelines rarely aligning across regulators.
Remedies packages need to be jurisdiction-specific — map every relevant market and build remedies optionality into the deal structure from the start, not reactively.$s6$),
('private-equity-exit-strategies-in-a-higher-rate-environment', $s7$Exit timelines built on pre-2023 leverage assumptions no longer close the way they used to under current financing costs.
Continuation vehicles have moved from a niche tool for trophy assets to a mainstream option for extending holds on fundamentally sound portfolio companies.
Dual-track processes and more aggressive earnout structures are becoming standard as operational value creation, not multiple expansion, carries the return thesis.$s7$),
('restructuring-distressed-assets-lessons-from-recent-cross-border-insolvencies', $s8$Cross-border insolvencies fail when a plan built around one jurisdiction's assumptions collides with another jurisdiction's creditor priority rules mid-implementation.
Recognition of a restructuring plan in every relevant jurisdiction needs to start in week one, not as a late-stage administrative step.
Map creditor priority under every relevant jurisdiction's law before finalising terms, and sequence recognition filings to run in parallel with negotiation.$s8$),
('capital-markets-compliance-after-the-latest-disclosure-reforms', $s9$Expanded disclosure requirements are straining compliance less on understanding what to disclose and more on building the process to actually produce it on schedule.
Assign clear ownership for each new disclosure category to a specific internal function, with a full quarter of buffer before the first mandatory filing.
Early enforcement has focused on inconsistency between regulatory filings and investor-facing materials — align legal, investor relations, and data owners in one review cycle.$s9$)
) as v(slug, ai_summary)
where a.slug = v.slug and a.ai_summary is null;
