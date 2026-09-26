-- Ticket 10 / SCRUM-128: teacher-level assignments above period folders.
-- One assignment per teacher + type + M/U/L owns the reference (answer key /
-- exemplar / none); every period's grading_session for it points here.

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  assignment_type text not null check (
    assignment_type in ('hw', 'short_response', 'essay')
  ),
  module_label text,
  unit_label text,
  lesson_label text,
  unit_id uuid references public.units (id) on delete set null,
  reference_kind text not null default 'none' check (
    reference_kind in ('answer_key', 'exemplar', 'none')
  ),
  reference_text text,
  reference_filename text,
  reference_storage_path text,
  reference_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assignments_teacher_path_uidx
  on public.assignments (
    teacher_id,
    assignment_type,
    (coalesce(module_label, '')),
    (coalesce(unit_label, '')),
    (coalesce(lesson_label, ''))
  );

alter table public.assignments enable row level security;

comment on table public.assignments is
  'Teacher-level assignment (type + M/U/L). Holds the shared reference used by every period folder.';
comment on column public.assignments.reference_kind is
  'answer_key = correctness source; exemplar = quality compare (may contain student PII — sanitize before AI); none = rubric only.';
comment on column public.assignments.reference_updated_at is
  'Bumped when the reference changes so suggestions can record which key version they used.';

alter table public.grading_sessions
  add column if not exists assignment_id uuid
    references public.assignments (id) on delete set null;

create index if not exists grading_sessions_assignment_id_idx
  on public.grading_sessions (assignment_id);

comment on column public.grading_sessions.assignment_id is
  'Teacher-level assignment this period folder belongs to. Null for legacy title-only folders.';

-- Backfill: one assignment per existing folder path (title-only folders stay unlinked).
insert into public.assignments (teacher_id, assignment_type, module_label, unit_label, lesson_label)
select distinct teacher_id, assignment_type, module_label, unit_label, lesson_label
from public.grading_sessions
where coalesce(module_label, unit_label, lesson_label) is not null
on conflict do nothing;

update public.grading_sessions gs
set assignment_id = a.id
from public.assignments a
where gs.assignment_id is null
  and a.teacher_id = gs.teacher_id
  and a.assignment_type = gs.assignment_type
  and coalesce(a.module_label, '') = coalesce(gs.module_label, '')
  and coalesce(a.unit_label, '') = coalesce(gs.unit_label, '')
  and coalesce(a.lesson_label, '') = coalesce(gs.lesson_label, '');
