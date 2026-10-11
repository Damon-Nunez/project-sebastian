-- Ticket 12 / SCRUM-135: explicit "entered the app" timestamp.
-- Later roster or rubric edits must not send the teacher back through setup.
alter table public.teachers
  add column if not exists setup_completed_at timestamptz;

comment on column public.teachers.setup_completed_at is
  'When the teacher finished first-login setup and entered the app. Null means the checklist is still required.';

-- One-time: teachers who already have a profile, a student, and a daily rubric
-- skip the new checklist. New accounts stay null until they press Enter app.
update public.teachers t
set
  setup_completed_at = now(),
  updated_at = now()
where t.setup_completed_at is null
  and length(trim(coalesce(t.display_name, ''))) > 0
  and length(trim(coalesce(t.subject, ''))) > 0
  and length(trim(coalesce(t.grade_label, ''))) > 0
  and length(trim(coalesce(t.honorific, ''))) > 0
  and exists (
    select 1 from public.students s where s.teacher_id = t.id
  )
  and exists (
    select 1
    from public.rubrics r
    where r.teacher_id = t.id
      and r.kind in ('hw', 'short_response')
      and r.section_id is null
      and r.unit_id is null
      and r.criteria is not null
  );
