-- Ticket 2.2: roster schema — sections (periods) + students
create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  name text not null,
  school_year text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sections_teacher_id_idx
  on public.sections (teacher_id);

comment on table public.sections is
  'Class periods/sections for a teacher (e.g. Period 1). Roster container only.';
comment on column public.sections.school_year is
  'Optional school year label (e.g. 2025-26). Avoids August roster confusion.';

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete cascade,
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_teacher_id_idx
  on public.students (teacher_id);

create index if not exists students_section_id_idx
  on public.students (section_id);

comment on table public.students is
  'Roster row for one section. Duplicate names allowed; identity is this row, not a global person.';
comment on column public.students.notes is
  'Optional teacher-entered accommodations / context. Surfaced in grading; never silently applied.';
comment on column public.students.teacher_id is
  'Denormalized owner for simple teacher-scoped queries and future RLS.';
