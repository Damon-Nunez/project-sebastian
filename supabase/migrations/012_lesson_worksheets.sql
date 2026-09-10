-- Teacher-uploaded worksheets attached to a lesson plan (separate from section images).

create table if not exists public.lesson_worksheets (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  lesson_plan_id uuid not null references public.lesson_plans (id) on delete cascade,
  original_filename text not null,
  storage_path text not null,
  mime_type text not null,
  caption text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lesson_worksheets_teacher_id_idx
  on public.lesson_worksheets (teacher_id);

create index if not exists lesson_worksheets_lesson_plan_id_idx
  on public.lesson_worksheets (lesson_plan_id);

comment on table public.lesson_worksheets is
  'Worksheet uploads for a lesson draft. Blank until the teacher adds files.';
comment on column public.lesson_worksheets.storage_path is
  'Object path in the lesson-plan-images Storage bucket (worksheets/ prefix).';

alter table public.lesson_worksheets enable row level security;
