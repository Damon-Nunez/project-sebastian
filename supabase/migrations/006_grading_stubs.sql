-- Ticket 2.5: grading session + suggestion stubs (no upload/AI pipeline)
create table if not exists public.grading_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete cascade,
  rubric_id uuid not null references public.rubrics (id) on delete restrict,
  assignment_type text not null check (
    assignment_type in ('hw', 'short_response', 'essay')
  ),
  title text,
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grading_sessions_teacher_id_idx
  on public.grading_sessions (teacher_id);

create index if not exists grading_sessions_section_id_idx
  on public.grading_sessions (section_id);

create index if not exists grading_sessions_rubric_id_idx
  on public.grading_sessions (rubric_id);

comment on table public.grading_sessions is
  'Stub batch/container for grading a section against a rubric. UI/AI pipeline comes in Tickets 9–11.';
comment on column public.grading_sessions.assignment_type is
  'Teacher-selected type (hw / short_response / essay) — drives which rubric applies.';

create table if not exists public.grading_suggestions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  grading_session_id uuid not null references public.grading_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  suggested_range_low numeric,
  suggested_range_high numeric,
  suggested_comment text,
  accommodation_flagged boolean not null default false,
  teacher_grade numeric,
  teacher_comment text,
  status text not null default 'draft' check (status in ('draft', 'final')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grading_suggestions_teacher_id_idx
  on public.grading_suggestions (teacher_id);

create index if not exists grading_suggestions_session_id_idx
  on public.grading_suggestions (grading_session_id);

create index if not exists grading_suggestions_student_id_idx
  on public.grading_suggestions (student_id);

comment on table public.grading_suggestions is
  'Per-student AI suggestion stub. Ranges are numeric so 1-4 or 0-100 can both fit later.';
comment on column public.grading_suggestions.accommodation_flagged is
  'True when student notes were considered — visible to teacher; never a silent grade change.';
comment on column public.grading_suggestions.teacher_grade is
  'Teacher-edited final grade after reviewing the suggested range. Nullable until set.';

alter table public.documents
  add column if not exists grading_session_id uuid
    references public.grading_sessions (id) on delete set null;

create index if not exists documents_grading_session_id_idx
  on public.documents (grading_session_id);

comment on column public.documents.grading_session_id is
  'Optional link when the upload belongs to a grading batch.';
