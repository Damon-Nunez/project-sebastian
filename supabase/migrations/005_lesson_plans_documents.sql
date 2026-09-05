-- Ticket 2.4: shared lesson plans (M/U/L labels on row) + document metadata
create table if not exists public.lesson_plans (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  module_label text,
  unit_label text,
  lesson_label text,
  content jsonb not null default '{}'::jsonb,
  section_groups jsonb not null default '{}'::jsonb,
  free_text_asks text,
  status text not null default 'draft' check (status in ('draft', 'final')),
  drive_file_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_plans_teacher_id_idx
  on public.lesson_plans (teacher_id);

create index if not exists lesson_plans_teacher_labels_idx
  on public.lesson_plans (teacher_id, module_label, unit_label, lesson_label);

comment on table public.lesson_plans is
  'Shared lesson plan for a teacher (not per-section). M/U/L are flexible labels on this row.';
comment on column public.lesson_plans.module_label is
  'Flexible module name or number (e.g. "1" or "Mariposas").';
comment on column public.lesson_plans.unit_label is
  'Flexible unit name or number (e.g. "1" or "Unit 1").';
comment on column public.lesson_plans.lesson_label is
  'Flexible lesson name or number (e.g. "7" or "Lesson 7").';
comment on column public.lesson_plans.content is
  'Parsed / pre-filled / edited plan structure (flexible Work Time blocks).';
comment on column public.lesson_plans.section_groups is
  'Per-section temporary groups keyed by section_id. Plan body is shared; rosters differ by period.';
comment on column public.lesson_plans.drive_file_id is
  'Filled when Ticket 6 saves to Google Drive. Nullable until then.';

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  kind text not null check (kind in ('framework', 'student_work', 'other')),
  original_filename text,
  storage_path text,
  lesson_plan_id uuid references public.lesson_plans (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_teacher_id_idx
  on public.documents (teacher_id);

create index if not exists documents_lesson_plan_id_idx
  on public.documents (lesson_plan_id);

comment on table public.documents is
  'Upload metadata only. File bytes live in Storage later; storage_path may be null until then.';
comment on column public.documents.kind is
  'framework = district lesson doc; student_work = grading upload; other = catch-all.';
comment on column public.documents.storage_path is
  'Object path in Storage when wired. Nullable in Ticket 2.';
