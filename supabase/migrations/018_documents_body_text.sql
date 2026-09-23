-- Ticket 9 / SCRUM-122: persist extracted student-work text for match + pre-grade editor.
-- grading_session_id stays null until the teacher saves into an assignment folder (2.4).

alter table public.documents
  add column if not exists body_text text;

comment on column public.documents.body_text is
  'Extracted (and later teacher-edited) plain text for student_work uploads. Null for framework docs.';
