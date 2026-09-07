-- Ticket 4 follow-up: store Google display name on teacher for header UI
alter table public.teachers
  add column if not exists display_name text;

comment on column public.teachers.display_name is
  'Full name from Google OAuth (or similar). Refreshed on each login sync.';
