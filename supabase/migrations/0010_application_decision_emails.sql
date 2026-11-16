-- Two new app events: an admin approving or rejecting a membership application now has a
-- dedicated email automation, same as the existing submission-confirmation events (0004_tables.sql
-- "Email engine"). Keys are fixed in code (AutomationKey in apps/backend/src/email/automations.ts).
-- Seed only — email_automations/email_messages/email_suppressions already exist, RLS already on.
begin;

insert into public.email_automations (key, name, description, resend_template, enabled) values
  ('application_approved', 'Application approved',
   'Sent when an admin approves a membership application.', 'application-approved', false),
  ('application_rejected', 'Application rejected',
   'Sent when an admin rejects a membership application. Supplies REASON.', 'application-rejected', false)
on conflict (key) do nothing;

commit;
