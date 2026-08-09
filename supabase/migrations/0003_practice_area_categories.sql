-- Adds a category to practice_areas: Taxation / Legal / Finance & Advisory.
-- Backs the category-pill filter in design/static_html/onboarding_form.html's
-- service-preference step. Mapping sourced directly from
-- design/static_html/assets/onboarding-form.js's own authoritative
-- category-per-practice-area list — not guessed or re-derived.
--
-- Lives here (continuing supabase/migrations/ numbering), not in
-- db/migrations/, even though this migration's own SQL never touches
-- auth.* — practice_areas was created in 0002 as part of that migration's
-- one bundled logical change, and keeping a single table's full schema
-- history in one folder beats a mechanical re-application of the auth.*
-- test to every later alteration. See both folders' README.md, updated
-- alongside this migration to state that refinement explicitly.

create type practice_area_category as enum ('taxation', 'legal', 'finance_advisory');

alter table public.practice_areas add column category practice_area_category;

update public.practice_areas set category = 'taxation'
  where name in ('M&A Tax', 'Transfer Pricing', 'Indirect Tax');

update public.practice_areas set category = 'legal'
  where name in ('Corporate Law', 'IP & Technology', 'Banking & Finance', 'Dispute Resolution');

update public.practice_areas set category = 'finance_advisory'
  where name in ('Capital Markets', 'Private Equity', 'Restructuring', 'Compliance', 'Antitrust');

alter table public.practice_areas alter column category set not null;

create index practice_areas_category_idx on public.practice_areas (category);
