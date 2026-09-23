-- Ticket 9 / SCRUM-123: assigned student on an upload before it is filed
-- into a grading_session (session + suggestion row come on editor save).

alter table public.documents
  add column if not exists student_id uuid
    references public.students (id) on delete set null;

create index if not exists documents_student_id_idx
  on public.documents (student_id);

comment on column public.documents.student_id is
  'Roster student matched or picked for this student_work upload. Null until assigned.';
