-- Optional display name for teacher-level assignments.
-- When set, UI uses it instead of the M/U/L short form (M1U1L1-HW).

alter table public.assignments
  add column if not exists title text;

comment on column public.assignments.title is
  'Optional teacher-facing name. When present, shown instead of the M/U/L short form.';
