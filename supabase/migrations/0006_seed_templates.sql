-- ============================================================================
-- 0006 — Templates launch content (US-14): 12 GrowXQ starter templates (Word / Excel /
-- PowerPoint) and 3 template kits. Real, usable starter drafts — every file is marked as a
-- template to adapt, not professional advice. All templates are members-only.
--
-- file_path is an object path in the PRIVATE `template-files` bucket; preview_image_url is a path in
-- the public `resource-assets` bucket (templates/previews/<slug>.jpg). For a fresh project, restore
-- both buckets from an external Storage backup with these same object paths. Binaries are not kept
-- in Git.
--
-- Re-runnable: every insert is `on conflict (id) do nothing`, so applying this again (e.g. via
-- `supabase db push`) skips rows that already exist and never overwrites an admin's later edits.
-- ============================================================================

insert into public.templates
  (id, slug, title, description, category, highlights, file_type, file_path, file_name, file_size_bytes, audiences, is_featured, sort_order)
values
  ('8459155f-7ac8-46c4-bec9-30f40ae7cf6d', 'audit-planning-memorandum', 'Audit Planning Memorandum', 'Scope, risk assessment and engagement timeline in a standard planning format.', 'Audit', array['Materiality and significant-risk tables', 'Team and timeline plan', 'Partner approval block']::text[], 'docx', 'starter/audit-planning-memorandum.docx', 'Audit Planning Memorandum.docx', 38833, array['audit']::text[], true, 10),
  ('8c185edb-561a-4b6f-a35e-21ee15bcedbf', 'internal-controls-checklist', 'Internal Controls Checklist', 'Walkthrough checklist covering entity-level and process-level controls.', 'Audit', array['13 pre-filled controls across 6 cycles', 'Result dropdowns with deficiency flags', 'Auto-calculating summary sheet']::text[], 'xlsx', 'starter/internal-controls-checklist.xlsx', 'Internal Controls Checklist.xlsx', 7951, array['audit']::text[], false, 20),
  ('a5ff4e86-c96c-4664-bc4a-4f1ca1054bee', 'audit-report-standard-format', 'Audit Report — Standard Format', 'A clean, review-ready structure for opinions, findings and management letters.', 'Audit', array['Opinion, basis and key audit matters', 'Management letter appendix', 'Signature and UDIN block']::text[], 'docx', 'starter/audit-report-standard-format.docx', 'Audit Report - Standard Format.docx', 38654, array['audit']::text[], false, 30),
  ('040d9ac1-f899-4975-bfbf-e1d33380171b', 'sampling-materiality-workbook', 'Sampling & Materiality Workbook', 'Pre-built formulas for sample size, materiality thresholds and error projection.', 'Audit', array['Materiality from any benchmark', 'Monetary-unit sample size and interval', 'Error projection vs tolerable misstatement']::text[], 'xlsx', 'starter/sampling-materiality-workbook.xlsx', 'Sampling & Materiality Workbook.xlsx', 9006, array['audit']::text[], true, 40),
  ('7cfac65a-6461-403e-82f6-214be792b0c5', 'tax-due-diligence-checklist', 'Tax Due Diligence Checklist', 'A structured checklist for M&A and transaction tax due diligence reviews.', 'Tax', array['16 review points across direct, indirect and TP', 'Status and risk dropdowns', 'Exposure summary by risk level']::text[], 'xlsx', 'starter/tax-due-diligence-checklist.xlsx', 'Tax Due Diligence Checklist.xlsx', 7849, array['tax']::text[], false, 50),
  ('f873c8ae-24e7-4aa1-a1e7-523e69ef822a', 'gst-reconciliation-workbook', 'GST Reconciliation Workbook', 'Reconcile GSTR filings against books with pre-built variance formulas.', 'Tax', array['Books vs GSTR-2B for 100 invoices', 'Automatic match / mismatch / missing status', 'Input tax credit at risk summary']::text[], 'xlsx', 'starter/gst-reconciliation-workbook.xlsx', 'GST Reconciliation Workbook.xlsx', 13329, array['tax']::text[], true, 60),
  ('aca47e1f-30d2-4073-9de4-cee62829bfd7', 'transfer-pricing-documentation', 'Transfer Pricing Documentation Template', 'Local file structure covering functional analysis, benchmarking and conclusions.', 'Tax', array['FAR analysis prompts', 'Transactions and method table', 'Benchmarking and annexure checklist']::text[], 'docx', 'starter/transfer-pricing-documentation.docx', 'Transfer Pricing Documentation Template.docx', 38582, array['tax']::text[], false, 70),
  ('cb542ef3-c94b-4275-9a9b-ff805facef6c', 'tax-position-memo', 'Tax Position Memo', 'A concise format for documenting and defending technical tax positions.', 'Tax', array['Issue, facts, law, analysis, conclusion', 'Level-of-comfort wording', 'Exposure and recommendations']::text[], 'docx', 'starter/tax-position-memo.docx', 'Tax Position Memo.docx', 38190, array['tax']::text[], false, 80),
  ('ad0f386f-0907-45b1-a303-0b4949caa68b', 'engagement-letter', 'Engagement Letter Template', 'Standard client engagement letter with scope, fees and liability clauses.', 'Legal', array['Scope and out-of-scope sections', 'Fees, liability cap and termination', 'Client acceptance block']::text[], 'docx', 'starter/engagement-letter.docx', 'Engagement Letter Template.docx', 38437, array['tax', 'legal', 'audit']::text[], false, 90),
  ('f33e0595-7b4d-4d99-ae68-7dbc1d6ca2c4', 'nda-mutual', 'NDA — Mutual', 'A balanced mutual non-disclosure agreement for early-stage client discussions.', 'Legal', array['10 balanced clauses', 'Standard exclusions and compelled disclosure', 'Two-party signature table']::text[], 'docx', 'starter/nda-mutual.docx', 'NDA - Mutual.docx', 38660, array['tax', 'legal', 'audit']::text[], false, 100),
  ('1ceb902a-e52d-48b7-9dc2-ee57cc076b13', 'board-resolution', 'Board Resolution Template', 'Common board resolution formats for approvals, appointments and authorisations.', 'Legal', array['Financial statements approval', 'Director appointment and bank account', 'Certified true copy format']::text[], 'docx', 'starter/board-resolution.docx', 'Board Resolution Template.docx', 38201, array['legal']::text[], false, 110),
  ('b2afa269-bad9-4d82-8be0-44173716596b', 'client-pitch-deck-legal-services', 'Client Pitch Deck — Legal Services', 'A ready-to-brand deck structure for pitching legal engagements to new clients.', 'Legal', array['10 slides: issues, approach, team, fees', 'Two fee options', 'Timeline and next steps']::text[], 'pptx', 'starter/client-pitch-deck-legal-services.pptx', 'Client Pitch Deck - Legal Services.pptx', 41468, array['legal']::text[], false, 120)
on conflict (id) do nothing;

insert into public.collections
  (id, kind, slug, title, description, audiences, item_ids, sort_order)
values
  ('d729a4d6-6bdf-46cd-abca-77f3cb926626', 'template_kit', 'new-audit-engagement', 'New audit engagement', 'Plan, test and report: the core working papers for a statutory audit.', array['audit']::text[], array['8459155f-7ac8-46c4-bec9-30f40ae7cf6d', '040d9ac1-f899-4975-bfbf-e1d33380171b', '8c185edb-561a-4b6f-a35e-21ee15bcedbf', 'a5ff4e86-c96c-4664-bc4a-4f1ca1054bee']::uuid[], 10),
  ('917bca57-1195-4599-a5a1-b395b11d8056', 'template_kit', 'transaction-tax-review', 'Transaction tax review', 'Diligence, reconcile and document positions on a deal or restructuring.', array['tax']::text[], array['7cfac65a-6461-403e-82f6-214be792b0c5', 'f873c8ae-24e7-4aa1-a1e7-523e69ef822a', 'aca47e1f-30d2-4073-9de4-cee62829bfd7', 'cb542ef3-c94b-4275-9a9b-ff805facef6c']::uuid[], 20),
  ('a5ab0b2a-720f-4acf-9460-c4db5597492c', 'template_kit', 'client-onboarding', 'Client onboarding', 'Win and formalise a new engagement: pitch, protect and paper it.', array['tax', 'legal', 'audit']::text[], array['b2afa269-bad9-4d82-8be0-44173716596b', 'f33e0595-7b4d-4d99-ae68-7dbc1d6ca2c4', 'ad0f386f-0907-45b1-a303-0b4949caa68b', '1ceb902a-e52d-48b7-9dc2-ee57cc076b13']::uuid[], 30)
on conflict (id) do nothing;

-- Preview images (first page / sheet / slide rendered from each file's real content).
update public.templates set preview_image_url = 'templates/previews/' || slug || '.jpg'
 where file_path like 'starter/%';
