-- Ticket 9 / SCRUM-121: assignment "folder" labels on grading_sessions
-- Local hierarchy: period (section) → Module / Unit / Lesson — Drive sync later.

alter table public.grading_sessions
  add column if not exists module_label text,
  add column if not exists unit_label text,
  add column if not exists lesson_label text;

comment on column public.grading_sessions.module_label is
  'Curriculum module label for the assignment folder (e.g. "1").';
comment on column public.grading_sessions.unit_label is
  'Curriculum unit label for the assignment folder (e.g. "1").';
comment on column public.grading_sessions.lesson_label is
  'Curriculum lesson label for the assignment folder (e.g. "1").';

-- One local folder per period + assignment type + M/U/L path (nulls coalesce to '').
create unique index if not exists grading_sessions_assignment_folder_uidx
  on public.grading_sessions (
    teacher_id,
    section_id,
    assignment_type,
    (coalesce(module_label, '')),
    (coalesce(unit_label, '')),
    (coalesce(lesson_label, ''))
  );
