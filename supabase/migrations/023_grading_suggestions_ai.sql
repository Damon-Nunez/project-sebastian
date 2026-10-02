-- Ticket 10 / SCRUM-130: AI grading (text path) results on each suggestion.
-- Filing a paper sets ai_status = 'pending'; the browser then grades it.

alter table public.grading_suggestions
  add column if not exists ai_status text check (
    ai_status in ('pending', 'grading', 'graded', 'failed', 'needs_vision')
  ),
  add column if not exists grading_detail jsonb,
  add column if not exists graded_reference_at timestamptz;

create index if not exists grading_suggestions_ai_status_idx
  on public.grading_suggestions (ai_status)
  where ai_status in ('pending', 'grading', 'failed');

comment on column public.grading_suggestions.ai_status is
  'pending → grading → graded | failed. needs_vision = photo/scan, waits for the vision path.';
comment on column public.grading_suggestions.grading_detail is
  'Per-question verdicts, rubric category scores, score mode and the computed percent behind the range.';
comment on column public.grading_suggestions.graded_reference_at is
  'assignments.reference_updated_at at grading time — detects grades made against an older key.';
