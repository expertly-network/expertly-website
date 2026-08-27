-- ============================================================================
-- DEV-ONLY SEED DATA — 50 mock members, for locally testing /members and
-- /members/[id] against real data.
--
-- NOT part of the pre-production single-schema convention in
-- supabase/migrations/README.md (0001-0004 are the source of truth for the
-- actual schema, folded together on every change). This file is a deliberate
-- one-off exception: apply it manually when you want test data, delete it
-- (see the teardown block at the bottom) when you don't. Never apply this to
-- a production database.
--
-- Apply: paste into the Supabase SQL Editor (or `psql "$DATABASE_URL" -f
-- supabase/migrations/0005_dev_seed_members.sql`) against your dev project.
--
-- What this does:
--   1. Inserts 50 rows into auth.users — minimal, non-loginable fakes (no
--      real password; these accounts cannot sign in). This exists purely to
--      satisfy profiles.id's FK to auth.users(id).
--   2. The existing `on_auth_user_created` trigger (0003_functions.sql) auto-
--      creates a matching `profiles` row from each user's raw_user_meta_data
--      (first_name/last_name) — nothing to do manually there.
--   3. Flips each seeded profile's role to 'member' (the trigger defaults new
--      profiles to role='client').
--   4. Inserts the matching member_profiles row (headline, bio, location,
--      rate, tier, and the 8 jsonb content sections) for each.
--   5. Links each member to 2 real practice_areas rows via member_services.
--
-- Every seeded auth.users row carries raw_user_meta_data->>'seed' =
-- 'expertly_dev_members' and a @expertlyseed.test email — both make the
-- rows trivially identifiable for cleanup (see teardown block).
--
-- Not idempotent by design: re-running this while the previous seed rows
-- still exist will fail on the unique email/index constraints (profiles.email,
-- auth.users' partial unique email index) rather than silently duplicating
-- 50 more rows. Run the teardown block first if you want to reseed.
-- ============================================================================

begin;

with
numbers as (
  select generate_series(1, 50) as n
),
names as (
  select
    n,
    (array[
      'Aarav','Vikram','Ananya','Priya','Rohan','Meera','Arjun','Kavya','Rahul','Sanya',
      'Karan','Divya','Aditya','Neha','Vivaan','Ishaan','Tara','Kabir','Diya','Ayaan',
      'Marcus','Elena','James','Sofia','Lucas','Amara','Noah','Zara','Liam','Yuki',
      'Wei','Fatima','Omar','Layla','Hassan','Nadia','Chen','Mei','Hiro','Sakura',
      'Oliver','Charlotte','William','Emma','Henry','Grace','Alexander','Isabella','Daniel','Sophie'
    ])[n] as first_name,
    (array[
      'Sharma','Mehta','Iyer','Reddy','Kapoor','Nair','Gupta','Rao','Malhotra','Bose',
      'Chen','Wong','Tanaka','Kim','Osei','Al-Farsi','Khoury','Haddad','Novak','Kowalski',
      'Silva','Santos','Martinez','Garcia','Rossi','Bianchi','Muller','Schmidt','Dubois','Laurent',
      'Anderson','Clarke','Bennett','Sullivan','Murphy','Walsh','Fitzgerald','Whitfield','Harrington','Blackwood',
      'Devereux','Okafor','Adeyemi','Costa','Moreau','Lindqvist','Berg','Novikov','Petrov','Choudhury'
    ])[n] as last_name
  from numbers
),
firms as (
  select
    n,
    (array[
      'Meridian Advisors','Ashford & Partners','Northbridge Legal','Cascade Tax Group',
      'Sterling Compliance','Harbor Capital Advisory','Whitmore & Co.','Beacon Restructuring',
      'Independent','Prime Counsel Group','Elevate Advisory','Lumen Legal','Anchor Partners',
      'Cardinal Tax Advisors','Vantage Point Law','Bridgeway Consulting'
    ])[((n - 1) % 16) + 1] as firm_name
  from numbers
),
locations as (
  select
    n,
    -- Full country names, not ISO codes — matches lib/members/countries.ts's ALL_COUNTRIES
    -- list (the country filter's own option values) and the design's card copy
    -- ("Chennai, India"), not a 2-letter code the filter can't even match against.
    (array['India','India','Singapore','United Kingdom','United Arab Emirates','United States','Germany','Japan','Australia','South Africa','Brazil','France'])[((n - 1) % 12) + 1] as country,
    (array['Mumbai','Chennai','Singapore','London','Dubai','New York','Frankfurt','Tokyo','Sydney','Johannesburg','Sao Paulo','Paris'])[((n - 1) % 12) + 1] as city,
    (array['south_asia','south_asia','asia_pacific','europe','middle_east','north_america','europe','asia_pacific','asia_pacific','africa','latin_america','europe'])[((n - 1) % 12) + 1] as region_text
  from numbers
),
practices as (
  select
    n,
    (array['M&A Tax','Transfer Pricing','Indirect Tax','Corporate Law','IP & Technology','Banking & Finance','Dispute Resolution','Capital Markets','Private Equity','Restructuring','Compliance','Antitrust'])[((n - 1) % 12) + 1] as primary_practice,
    (array['M&A Tax','Transfer Pricing','Indirect Tax','Corporate Law','IP & Technology','Banking & Finance','Dispute Resolution','Capital Markets','Private Equity','Restructuring','Compliance','Antitrust'])[((n + 5) % 12) + 1] as secondary_practice
  from numbers
),
profile_bits as materialized (
  select
    n.n,
    nm.first_name,
    nm.last_name,
    f.firm_name,
    loc.country,
    loc.city,
    loc.region_text::public.application_region as region,
    p.primary_practice,
    p.secondary_practice,
    3 + ((n.n * 7) % 25) as years_of_experience,
    (30000 + ((n.n * 37) % 400) * 100) as rate_min_cents,
    (30000 + ((n.n * 37) % 400) * 100) + (8000 + (n.n % 5) * 3000) as rate_max_cents,
    case when 3 + ((n.n * 7) % 25) >= 10 then 'seasoned_professional' else 'budding_entrepreneur' end::public.membership_tier as member_tier,
    (n.n % 10 <> 0) as is_verified,
    (n.n % 7 <> 0) as is_available,
    gen_random_uuid() as new_user_id
  from numbers n
  join names nm using (n)
  join firms f using (n)
  join locations loc using (n)
  join practices p using (n)
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000',
  new_user_id,
  'authenticated',
  'authenticated',
  'member' || n || '@expertlyseed.test',
  -- No password hash — left null. These accounts cannot sign in (not a usable credential),
  -- and this project's migrations never enable the pgcrypto extension crypt()/gen_salt()
  -- would need, so this deliberately avoids that dependency rather than gambling on whether
  -- pgcrypto happens to be enabled on this Supabase project by default.
  null,
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'seed', 'expertly_dev_members',
    'first_name', first_name,
    'last_name', last_name
  ),
  false,
  false
from profile_bits;

-- The on_auth_user_created trigger has now fired for each row above, creating the matching
-- public.profiles row (role defaults to 'client') — flip it to 'member'. Matched by the
-- deterministic seed email (which the trigger copies from auth.users.email into
-- profiles.email) rather than by id, so this doesn't depend on reusing any value generated in
-- the statement above across a separate top-level statement.
update public.profiles
set role = 'member'
where email like '%@expertlyseed.test';

-- ============================================================================
-- member_profiles — one per seeded profile, using the same profile_bits CTE (re-declared;
-- CTEs don't survive across separate top-level statements in the same transaction).
-- ============================================================================

with
numbers as (
  select generate_series(1, 50) as n
),
names as (
  select
    n,
    (array[
      'Aarav','Vikram','Ananya','Priya','Rohan','Meera','Arjun','Kavya','Rahul','Sanya',
      'Karan','Divya','Aditya','Neha','Vivaan','Ishaan','Tara','Kabir','Diya','Ayaan',
      'Marcus','Elena','James','Sofia','Lucas','Amara','Noah','Zara','Liam','Yuki',
      'Wei','Fatima','Omar','Layla','Hassan','Nadia','Chen','Mei','Hiro','Sakura',
      'Oliver','Charlotte','William','Emma','Henry','Grace','Alexander','Isabella','Daniel','Sophie'
    ])[n] as first_name,
    (array[
      'Sharma','Mehta','Iyer','Reddy','Kapoor','Nair','Gupta','Rao','Malhotra','Bose',
      'Chen','Wong','Tanaka','Kim','Osei','Al-Farsi','Khoury','Haddad','Novak','Kowalski',
      'Silva','Santos','Martinez','Garcia','Rossi','Bianchi','Muller','Schmidt','Dubois','Laurent',
      'Anderson','Clarke','Bennett','Sullivan','Murphy','Walsh','Fitzgerald','Whitfield','Harrington','Blackwood',
      'Devereux','Okafor','Adeyemi','Costa','Moreau','Lindqvist','Berg','Novikov','Petrov','Choudhury'
    ])[n] as last_name
  from numbers
),
firms as (
  select
    n,
    (array[
      'Meridian Advisors','Ashford & Partners','Northbridge Legal','Cascade Tax Group',
      'Sterling Compliance','Harbor Capital Advisory','Whitmore & Co.','Beacon Restructuring',
      'Independent','Prime Counsel Group','Elevate Advisory','Lumen Legal','Anchor Partners',
      'Cardinal Tax Advisors','Vantage Point Law','Bridgeway Consulting'
    ])[((n - 1) % 16) + 1] as firm_name
  from numbers
),
locations as (
  select
    n,
    -- Full country names, not ISO codes — matches lib/members/countries.ts's ALL_COUNTRIES
    -- list (the country filter's own option values) and the design's card copy
    -- ("Chennai, India"), not a 2-letter code the filter can't even match against.
    (array['India','India','Singapore','United Kingdom','United Arab Emirates','United States','Germany','Japan','Australia','South Africa','Brazil','France'])[((n - 1) % 12) + 1] as country,
    (array['Mumbai','Chennai','Singapore','London','Dubai','New York','Frankfurt','Tokyo','Sydney','Johannesburg','Sao Paulo','Paris'])[((n - 1) % 12) + 1] as city,
    (array['south_asia','south_asia','asia_pacific','europe','middle_east','north_america','europe','asia_pacific','asia_pacific','africa','latin_america','europe'])[((n - 1) % 12) + 1] as region_text
  from numbers
),
practices as (
  select
    n,
    (array['M&A Tax','Transfer Pricing','Indirect Tax','Corporate Law','IP & Technology','Banking & Finance','Dispute Resolution','Capital Markets','Private Equity','Restructuring','Compliance','Antitrust'])[((n - 1) % 12) + 1] as primary_practice,
    (array['M&A Tax','Transfer Pricing','Indirect Tax','Corporate Law','IP & Technology','Banking & Finance','Dispute Resolution','Capital Markets','Private Equity','Restructuring','Compliance','Antitrust'])[((n + 5) % 12) + 1] as secondary_practice
  from numbers
),
universities as (
  select n, (array['National Law School','London School of Economics','Singapore Management University','Harvard Law School','Delhi University','University of Cambridge','NYU Stern','INSEAD','University of Tokyo','University of Sydney'])[((n - 1) % 10) + 1] as university
  from numbers
),
clients as (
  select n, (array['a global manufacturing conglomerate','a Fortune 500 technology firm','a regional private equity fund','a listed financial services group','a multinational pharmaceutical company','a sovereign wealth fund'])[((n - 1) % 6) + 1] as client_desc
  from numbers
),
titles as (
  -- Job titles, not a "{practice} specialist" description — matches
  -- design/static_html/members.html's actual card copy ("Co-Founder at M2K Advisors", not
  -- "M&A Tax specialist, 18y experience"). Two pools so both tiers still read as senior
  -- (per docs/master-tdd.md's "0 junior associates" rule) without every seasoned member
  -- being literally "Partner".
  select
    n,
    case when 3 + ((n * 7) % 25) >= 10
      then (array['Partner', 'Managing Partner', 'Founder', 'Co-Founder', 'Managing Director', 'Senior Partner', 'Practice Head', 'Director'])[((n - 1) % 8) + 1]
      else (array['Senior Advisor', 'Principal Consultant', 'Senior Counsel', 'Practice Lead', 'Senior Associate Director', 'Head of Practice'])[((n - 1) % 6) + 1]
    end as title
  from numbers
),
profile_bits as (
  select
    seed.id as profile_id,
    nm.first_name,
    nm.last_name,
    f.firm_name,
    loc.country,
    loc.city,
    loc.region_text::public.application_region as region,
    p.primary_practice,
    p.secondary_practice,
    u.university,
    cl.client_desc,
    t.title,
    3 + ((n.n * 7) % 25) as years_of_experience,
    (30000 + ((n.n * 37) % 400) * 100) as rate_min_cents,
    (30000 + ((n.n * 37) % 400) * 100) + (8000 + (n.n % 5) * 3000) as rate_max_cents,
    case when 3 + ((n.n * 7) % 25) >= 10 then 'seasoned_professional' else 'budding_entrepreneur' end::public.membership_tier as member_tier,
    (n.n % 10 <> 0) as is_verified,
    (n.n % 7 <> 0) as is_available,
    n.n
  from numbers n
  join titles t using (n)
  join names nm using (n)
  join firms f using (n)
  join locations loc using (n)
  join practices p using (n)
  join universities u using (n)
  join clients cl using (n)
  -- Recover each generated auth.users id by joining back on the same seed marker + email
  -- (deterministic from n, since it was built the same way above).
  join auth.users seed on seed.email = 'member' || n.n || '@expertlyseed.test'
)
insert into public.member_profiles (
  profile_id, headline, bio, firm_name, firm_website, region, country, state, city,
  years_of_experience, rate_min_cents, rate_max_cents, rate_currency, member_tier,
  is_available, availability_notes, contact_email, contact_phone, linkedin_url, website,
  is_verified, photo_url, status,
  work_experiences, educations, engagements, qualifications, credentials, testimonials, awards, key_clients
)
select
  profile_id,
  title,
  first_name || ' ' || last_name || ' is a ' || lower(title) || ' with ' || years_of_experience
    || 'y of experience specialising in ' || primary_practice || ' '
    || (case when firm_name = 'Independent' then 'as an independent practitioner' else 'at ' || firm_name end)
    || ', based in ' || city || '. Available for cross-border mandates and international engagements.',
  firm_name,
  case when firm_name <> 'Independent' then 'https://www.' || lower(regexp_replace(firm_name, '[^a-zA-Z]', '', 'g')) || '.example.com' else null end,
  region,
  country,
  null,
  city,
  years_of_experience,
  rate_min_cents,
  rate_max_cents,
  'USD',
  member_tier,
  is_available,
  case when not is_available then 'Fully booked through next quarter.' else null end,
  lower(first_name) || '.' || lower(last_name) || '@' || lower(regexp_replace(firm_name, '[^a-zA-Z]', '', 'g')) || '.example.com',
  null,
  'https://www.linkedin.com/in/' || lower(first_name) || '-' || lower(last_name),
  null,
  is_verified,
  -- Dev-only mock headshots (randomuser.me, same placeholder service the design
  -- prototype itself uses) — alternates men/women by seed index so the directory/marquee
  -- don't render 50 identical-gender initials-fallback avatars.
  'https://randomuser.me/api/portraits/' || (case when n % 2 = 0 then 'women' else 'men' end)
    || '/' || ((n % 90) + 1)::text || '.jpg',
  'active',
  jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'title', case when member_tier = 'seasoned_professional' then 'Partner' else 'Senior Associate' end,
    'company', firm_name,
    'startYear', 2024 - years_of_experience,
    'endYear', null,
    'isCurrent', true,
    'description', 'Leads ' || primary_practice || ' engagements for clients across ' || region::text || '.'
  )),
  jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'degree', case when primary_practice in ('Corporate Law','IP & Technology','Banking & Finance','Dispute Resolution','Antitrust') then 'LLB' else 'MBA, Finance' end,
    'institution', university,
    'field', primary_practice,
    'endYear', 2024 - years_of_experience - 2
  )),
  jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'title', primary_practice || ' Advisory Panel',
    'organization', firm_name,
    'year', 2024 - (years_of_experience % 5),
    'url', null
  )),
  '[]'::jsonb,
  '[]'::jsonb,
  jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'quote', 'Exceptional depth on ' || primary_practice || ' — clear, timely, and pragmatic advice throughout a complex engagement.',
    'clientName', 'General Counsel',
    'clientTitle', 'General Counsel',
    'clientCompany', initcap(client_desc),
    'serviceName', primary_practice,
    'occurredOn', (date '2024-01-01' + ((n % 300)::text || ' days')::interval)::date::text,
    'isVerified', is_verified
  )),
  case when n % 3 = 0 then jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'title', primary_practice || ' Advisor of the Year',
    'issuingBody', 'Global Practitioners Guild',
    'year', 2024 - (n % 4),
    'description', 'Recognised for outstanding client outcomes in ' || primary_practice || '.'
  )) else '[]'::jsonb end,
  case when n % 4 = 0 then jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', initcap(client_desc),
    'logoUrl', null
  )) else '[]'::jsonb end
from profile_bits;

-- ============================================================================
-- member_services — 2 practice areas per member, by name (portable across environments;
-- practice_areas.id is gen_random_uuid()-generated, never hardcoded).
-- ============================================================================

with
numbers as (
  select generate_series(1, 50) as n
),
practices as (
  select
    n,
    (array['M&A Tax','Transfer Pricing','Indirect Tax','Corporate Law','IP & Technology','Banking & Finance','Dispute Resolution','Capital Markets','Private Equity','Restructuring','Compliance','Antitrust'])[((n - 1) % 12) + 1] as primary_practice,
    (array['M&A Tax','Transfer Pricing','Indirect Tax','Corporate Law','IP & Technology','Banking & Finance','Dispute Resolution','Capital Markets','Private Equity','Restructuring','Compliance','Antitrust'])[((n + 5) % 12) + 1] as secondary_practice
  from numbers
),
member_ids as (
  select n, u.id as profile_id
  from numbers n
  join auth.users u on u.email = 'member' || n.n || '@expertlyseed.test'
)
insert into public.member_services (member_id, practice_area_id)
select m.profile_id, pa.id
from member_ids m
join practices p using (n)
join public.practice_areas pa on pa.name in (p.primary_practice, p.secondary_practice)
on conflict do nothing;

commit;

-- ============================================================================
-- TEARDOWN — run this whenever you're done testing. Cascades through profiles,
-- member_profiles, and member_services automatically (all FK'd ON DELETE CASCADE).
-- ============================================================================
--
-- delete from auth.users where raw_user_meta_data ->> 'seed' = 'expertly_dev_members';
