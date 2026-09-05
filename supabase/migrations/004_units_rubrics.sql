-- Ticket 2.3: thin units (essay attachment) + rubrics with per-section override
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists units_teacher_id_idx
  on public.units (teacher_id);

comment on table public.units is
  'Thin label for essay-rubric attachment (e.g. "3" or "Unit 3"). Not a Module→Unit→Lesson tree.';
comment on column public.units.label is
  'Flexible name or number string; tighten later when district rules are confirmed.';

create table if not exists public.rubrics (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  kind text not null check (kind in ('hw', 'short_response', 'essay')),
  name text,
  criteria jsonb not null default '[]'::jsonb,
  unit_id uuid references public.units (id) on delete restrict,
  section_id uuid references public.sections (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rubrics_essay_unit_check check (
    kind <> 'essay' or unit_id is not null
  ),
  constraint rubrics_non_essay_unit_check check (
    kind = 'essay' or unit_id is null
  )
);

create index if not exists rubrics_teacher_id_idx
  on public.rubrics (teacher_id);

create index if not exists rubrics_section_id_idx
  on public.rubrics (section_id);

create index if not exists rubrics_unit_id_idx
  on public.rubrics (unit_id);

create index if not exists rubrics_kind_idx
  on public.rubrics (teacher_id, kind);

comment on table public.rubrics is
  'HW / short-response / essay rubrics. section_id null = teacher default; set = copy-on-write section override.';
comment on column public.rubrics.criteria is
  'JSON criteria + weights. Grade scale (1-4 vs 0-100) stays in metadata — not a hard column type.';
comment on column public.rubrics.section_id is
  'Null = shared default. Non-null = override for that section only (full row copy, not a patch language).';
comment on column public.rubrics.unit_id is
  'Required for essay rubrics; must be null for hw / short_response. ON DELETE RESTRICT — drop/reassign rubrics before deleting a unit.';
