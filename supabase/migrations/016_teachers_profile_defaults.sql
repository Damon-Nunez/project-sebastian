-- SCRUM-106 / 2.1: teacher profile defaults for lesson header chrome.
-- Settings / account-creation UI deferred — columns + seed only.
alter table public.teachers
  add column if not exists subject text,
  add column if not exists grade_label text,
  add column if not exists honorific text;

comment on column public.teachers.subject is
  'Default subject for lesson header (e.g. English Language Arts (ELA)). Copied onto new drafts; editable per plan.';

comment on column public.teachers.grade_label is
  'Default grade band for lesson header (e.g. 8th Grade). Text, not a numeric grade score.';

comment on column public.teachers.honorific is
  'Explicit honorific for teacher line (Mr, Ms, Mx, etc.). Never inferred from first name.';

-- Seed existing MVP teacher row(s). Safe to re-run: only fills nulls.
update public.teachers
set
  subject = coalesce(subject, 'English Language Arts (ELA)'),
  grade_label = coalesce(grade_label, '8th Grade'),
  honorific = coalesce(honorific, 'Mr'),
  updated_at = now()
where subject is null
   or grade_label is null
   or honorific is null;
