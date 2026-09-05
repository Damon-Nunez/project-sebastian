-- Ticket 2 follow-up: unit delete must not SET NULL essay rubrics (check requires unit_id)
-- Safe to run if 004 was already applied with ON DELETE SET NULL.

alter table public.rubrics
  drop constraint if exists rubrics_unit_id_fkey;

alter table public.rubrics
  add constraint rubrics_unit_id_fkey
  foreign key (unit_id) references public.units (id) on delete restrict;

comment on column public.rubrics.unit_id is
  'Required for essay rubrics; must be null for hw / short_response. ON DELETE RESTRICT — drop/reassign rubrics before deleting a unit.';
