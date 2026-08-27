-- ============================================================================
-- DEV-ONLY SEED DATA — 34 events (published), for locally testing GET /v1/events and the
-- homepage's Upcoming Events section against real data.
--
-- Same status as 0005_dev_seed_members.sql: not part of the pre-production single-schema
-- convention (supabase/migrations/README.md) — a deliberate one-off exception, apply/tear
-- down manually, never against production.
--
-- Content sourced verbatim from design/static_html/assets/members.js's
-- window.EXPERTLY_EVENTS (the design prototype's own seed data) — dates are the same
-- month/day, mapped onto 2026 (this app's "today"), not invented.
--
-- Apply: `psql "$DATABASE_URL" -f supabase/migrations/0006_dev_seed_events.sql`
-- Idempotent: re-running is safe — `on conflict (slug) do nothing`.
-- ============================================================================

insert into public.events (title, slug, description, start_date, end_date, event_format, country, city, organiser_name, event_type, status)
select v.title, v.slug, v.description, v.start_date, v.end_date, v.event_format, v.country, v.city, v.organiser_name, v.event_type, 'published'::event_status
from (values
('IPT 2026 Sales Tax School II', 'ipt-sales-tax-school', 'Second sales & use tax school, deepening SALT skills.', '2026-04-20'::date, '2026-04-24'::date, 'in_person', 'United States', 'Atlanta, GA', 'Institute for Professionals in Taxation', 'Tax'),
('American Society of International Law 120th Annual Meeting', 'asil-120th', '120th Annual Meeting with keynotes and substantive panels on international law.', '2026-04-22'::date, '2026-04-25'::date, 'in_person', 'United States', 'Washington, DC', 'ASIL', 'International Law'),
('ACCA Link Up: Financial Services', 'acca-link-up', 'Sector-specific networking for members in the FS industry.', '2026-04-22'::date, null, 'in_person', 'United Kingdom', 'London', 'ACCA', 'Networking'),
('IBA Annual Conference 2026', 'iba-annual', 'The world''s largest gathering of international lawyers and legal industry leaders.', '2026-05-03'::date, '2026-05-07'::date, 'in_person', 'South Korea', 'Seoul', 'International Bar Association', 'Legal'),
('TP Minds International', 'tp-minds', 'Leading transfer pricing conference for MNE tax directors and advisors.', '2026-05-12'::date, '2026-05-14'::date, 'hybrid', 'United Kingdom', 'London', 'IBC Events', 'Tax'),
('Global M&A Summit 2026', 'ma-summit-ny', 'Dealmakers, counsel, and PE partners on the year''s biggest transactions.', '2026-05-18'::date, '2026-05-19'::date, 'in_person', 'United States', 'New York, NY', 'Mergermarket', 'M&A'),
('GST Annual Conclave 2026', 'gst-annual-conclave', 'National conclave on GST reforms, e-invoicing mandates, and dispute trends for indirect tax practitioners.', '2026-06-03'::date, '2026-06-04'::date, 'in_person', 'India', 'Mumbai', 'Indirect Tax Professionals Forum', 'Tax'),
('ESG Disclosure & Reporting Summit', 'esg-disclosure-summit', 'Regulatory updates and practical guidance on ESG disclosure obligations across the EU, UK, and US.', '2026-06-09'::date, '2026-06-10'::date, 'hybrid', 'Netherlands', 'Amsterdam', 'Global Sustainability Council', 'General'),
('Fintech Regulatory Forum', 'fintech-regulatory-forum', 'Cross-border panel on licensing, payments regulation, and digital asset oversight for fintech counsel.', '2026-06-16'::date, null, 'in_person', 'Singapore', 'Singapore', 'Digital Finance Association', 'Legal'),
('Women in Law Leadership Network', 'women-in-law-network', 'Networking evening connecting senior women counsel and partners across practice areas.', '2026-06-25'::date, null, 'in_person', 'United Kingdom', 'London', 'Lex Mundi', 'Networking'),
('Private Equity Forum: Mid-Year Outlook', 'pe-forum-midyear', 'PE sponsors, fund counsel, and LPs assess deal flow, valuations, and exit strategy for H2 2026.', '2026-07-08'::date, '2026-07-09'::date, 'in_person', 'United States', 'New York, NY', 'Buyouts Insider', 'M&A'),
('IP Licensing & Technology Transfer Masterclass', 'ip-licensing-masterclass', 'Deep-dive workshop on structuring cross-border IP licensing and technology transfer agreements.', '2026-07-13'::date, '2026-07-15'::date, 'hybrid', 'Switzerland', 'Geneva', 'WIPO Academy', 'Legal'),
('APAC Tax Controversy & Dispute Resolution Conference', 'apac-tax-controversy', 'Practitioners compare notes on audit defense strategy and MAP resolution across APAC tax authorities.', '2026-07-20'::date, '2026-07-21'::date, 'in_person', 'Hong Kong', 'Hong Kong', 'Asia Pacific Tax Forum', 'Tax'),
('Global Merger Review & Antitrust Update', 'global-merger-review', 'Regulators and practitioners review the year''s merger clearance decisions and emerging antitrust theory.', '2026-07-27'::date, '2026-07-28'::date, 'in_person', 'Belgium', 'Brussels', 'Global Competition Review', 'Legal'),
('Transfer Pricing Webinar: Pillar Two in Practice', 'transfer-pricing-webinar-aug', 'Live webinar unpacking practical Pillar Two compliance challenges for multinational groups.', '2026-08-06'::date, null, 'hybrid', 'Singapore', 'Singapore', 'IBC Events', 'Tax'),
('M&A Due Diligence Intensive', 'ma-due-diligence-intensive', 'Two-day intensive on red-flag identification and warranty negotiation in cross-border acquisitions.', '2026-08-12'::date, '2026-08-13'::date, 'in_person', 'United Kingdom', 'London', 'Mergermarket', 'M&A'),
('UAE Corporate Tax Briefing: Year Two', 'uae-corporate-tax-briefing', 'Practical briefing on filing obligations and free-zone qualifying income as UAE corporate tax enters its second year.', '2026-08-19'::date, null, 'in_person', 'United Arab Emirates', 'Dubai', 'Gulf Advisory Partners', 'Tax'),
('Compliance Leaders Forum', 'compliance-leaders-forum', 'Chief compliance officers convene to benchmark whistleblowing, sanctions, and AML program design.', '2026-08-26'::date, '2026-08-27'::date, 'in_person', 'United States', 'New York, NY', 'Compliance Week', 'Audit'),
('Restructuring & Insolvency Congress', 'restructuring-insolvency-congress', 'Cross-border restructuring practitioners examine emerging trends in distressed M&A and scheme mechanisms.', '2026-09-08'::date, '2026-09-10'::date, 'in_person', 'Germany', 'Frankfurt', 'INSOL International', 'Legal'),
('AI Governance & Legal Risk Summit', 'ai-governance-legal-summit', 'In-house counsel and regulators discuss AI Act compliance, model risk, and liability frameworks.', '2026-09-14'::date, '2026-09-15'::date, 'hybrid', 'United States', 'San Francisco, CA', 'TechLaw Institute', 'AI & Tech'),
('Capital Markets Outlook: H2 2026', 'capital-markets-outlook-h2', 'Underwriters, issuers, and securities counsel assess IPO windows and debt market conditions for year-end.', '2026-09-21'::date, '2026-09-22'::date, 'in_person', 'Hong Kong', 'Hong Kong', 'IFLR', 'Legal'),
('Transfer Pricing Audit Defense Workshop', 'transfer-pricing-audit-defense', 'Practical workshop on documentation strategy and dispute resolution ahead of BEPS Pillar Two audits.', '2026-09-28'::date, null, 'hybrid', 'Spain', 'Madrid', 'TP Minds', 'Tax'),
('Global Tax Forum', 'global-tax-forum-paris', 'Senior tax directors and policymakers debate the next phase of international tax reform.', '2026-10-05'::date, '2026-10-08'::date, 'in_person', 'France', 'Paris', 'International Fiscal Association', 'Tax'),
('Privacy & Data Protection Congress', 'privacy-data-protection-congress', 'DPOs and privacy counsel compare GDPR, DPDP, and CCPA enforcement trends across jurisdictions.', '2026-10-12'::date, '2026-10-14'::date, 'hybrid', 'Belgium', 'Brussels', 'IAPP', 'Legal'),
('Private Fund Formation Summit', 'private-fund-formation-summit', 'Fund counsel and GPs discuss side-letter negotiation, ESG carve-outs, and continuation vehicles.', '2026-10-19'::date, '2026-10-20'::date, 'in_person', 'Cayman Islands', 'George Town', 'Private Equity International', 'M&A'),
('APAC Employment Law Conference', 'apac-employment-law-conf', 'Regional employment counsel review cross-border workforce restructuring and gig-economy classification rules.', '2026-10-26'::date, '2026-10-27'::date, 'in_person', 'Singapore', 'Singapore', 'Ius Laboris', 'Legal'),
('International Tax Conference', 'international-tax-conference', 'Deep-dive sessions on treaty interpretation, permanent establishment risk, and digital services taxes.', '2026-11-02'::date, '2026-11-04'::date, 'in_person', 'Netherlands', 'Amsterdam', 'IBFD', 'Tax'),
('Corporate Governance & Board Advisory Summit', 'corporate-governance-summit', 'General counsel and board advisors discuss director duties, disclosure risk, and activist defense.', '2026-11-09'::date, '2026-11-10'::date, 'in_person', 'United States', 'Chicago, IL', 'National Association of Corporate Directors', 'General'),
('Cairo Arbitration Week', 'cairo-arbitration-week', 'MENA arbitration practitioners convene for panels on enforcement, third-party funding, and investor-state disputes.', '2026-11-16'::date, '2026-11-19'::date, 'in_person', 'Egypt', 'Cairo', 'Cairo Regional Centre for International Commercial Arbitration', 'International Law'),
('Fintech & AI Compliance Roundtable', 'fintech-ai-compliance-roundtable', 'Roundtable on algorithmic lending oversight and AI audit obligations for financial services compliance teams.', '2026-11-23'::date, null, 'hybrid', 'Canada', 'Toronto', 'Compliance Week', 'Audit'),
('Year-End Tax Planning Briefing', 'year-end-tax-planning-briefing', 'Practical briefing on year-end structuring moves ahead of new-year filing and reporting deadlines.', '2026-12-03'::date, null, 'hybrid', 'Singapore', 'Singapore', 'Chen Advisory', 'Tax'),
('M&A Forecast 2027', 'ma-forecast-2027', 'Dealmakers preview expected deal volume, financing conditions, and regulatory headwinds for the year ahead.', '2026-12-08'::date, '2026-12-09'::date, 'in_person', 'United States', 'New York, NY', 'Mergermarket', 'M&A'),
('IP & Tech Law: Year in Review', 'ip-tech-year-in-review', 'Annual review of the year''s landmark IP, AI, and data rulings with practical takeaways for counsel.', '2026-12-14'::date, '2026-12-15'::date, 'hybrid', 'United Kingdom', 'London', 'Volkova Law', 'AI & Tech'),
('Expertly Annual Members Gala', 'expertly-annual-gala', 'Closing the year with Expertly''s verified member community — awards, networking, and a look ahead to 2027.', '2026-12-18'::date, null, 'in_person', 'United Arab Emirates', 'Dubai', 'Expertly', 'Networking')
) as v(title, slug, description, start_date, end_date, event_format, country, city, organiser_name, event_type)
on conflict (slug) do nothing;

-- ============================================================================
-- TEARDOWN — run this whenever you're done testing.
-- ============================================================================
--
-- delete from public.events where slug in (
--   'ipt-sales-tax-school','asil-120th','acca-link-up','iba-annual','tp-minds','ma-summit-ny',
--   'gst-annual-conclave','esg-disclosure-summit','fintech-regulatory-forum','women-in-law-network',
--   'pe-forum-midyear','ip-licensing-masterclass','apac-tax-controversy','global-merger-review',
--   'transfer-pricing-webinar-aug','ma-due-diligence-intensive','uae-corporate-tax-briefing',
--   'compliance-leaders-forum','restructuring-insolvency-congress','ai-governance-legal-summit',
--   'capital-markets-outlook-h2','transfer-pricing-audit-defense','global-tax-forum-paris',
--   'privacy-data-protection-congress','private-fund-formation-summit','apac-employment-law-conf',
--   'international-tax-conference','corporate-governance-summit','cairo-arbitration-week',
--   'fintech-ai-compliance-roundtable','year-end-tax-planning-briefing','ma-forecast-2027',
--   'ip-tech-year-in-review','expertly-annual-gala'
-- );
