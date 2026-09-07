-- Ticket 4 follow-up: optional student nickname for roster + sanitizer aliases
alter table public.students
  add column if not exists nickname text;

comment on column public.students.nickname is
  'Optional teacher-entered nickname/preferred name. Included in sanitizer aliases when set; never invented.';
