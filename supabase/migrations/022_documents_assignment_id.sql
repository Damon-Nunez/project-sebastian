-- Ticket 10 / SCRUM-129: batch uploads belong to an assignment before they are
-- filed. Unfiled work = assignment_id set, grading_session_id null; the review
-- list (Ready / Unsorted) is recomputed from these rows on every page load.

alter table public.documents
  add column if not exists assignment_id uuid
    references public.assignments (id) on delete set null;

create index if not exists documents_unfiled_assignment_idx
  on public.documents (assignment_id)
  where grading_session_id is null;

comment on column public.documents.assignment_id is
  'Assignment a batch upload was dropped into. Stays set after filing.';
