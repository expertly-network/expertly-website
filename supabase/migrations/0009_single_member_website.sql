-- 0009 — one website per member.
--
-- A member used to have two: `website` (the Contact section's "Company website", editable) and
-- `firm_website` (copied from the application's current job, never editable, shown separately).
-- There is now one — `website`. Members whose only website was the application's keep it: it is
-- copied into `website` where that is empty. `firm_website` is no longer read or written by the
-- code and is left in place (dropping it is a later migration, once nothing running reads it).
--
-- Additive and safe on live data: a single UPDATE that only fills empty values. Re-runnable.

begin;

update public.member_profiles
   set website = firm_website
 where (website is null or btrim(website) = '')
   and firm_website is not null
   and btrim(firm_website) <> '';

notify pgrst, 'reload schema';

commit;
