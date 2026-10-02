-- Ticket 10 / SCRUM-132: vision fallback for photos and scanned PDFs.
-- Each page is OCR'd on the server and stored twice: the original and a
-- masked copy (roster names + page-1 header strip blacked out). Only the
-- masked copy is ever sent to the AI, and only after the teacher approves it.

alter table public.documents
  add column if not exists vision_pages jsonb;

comment on column public.documents.vision_pages is
  'Photo / scan pages in order: [{ originalPath, maskedPath, width, height, headerStrip, nameBoxes }]. Null for text-graded work.';

alter table public.grading_suggestions
  drop constraint if exists grading_suggestions_ai_status_check;

alter table public.grading_suggestions
  add constraint grading_suggestions_ai_status_check check (
    ai_status in (
      'pending', 'grading', 'graded', 'failed', 'needs_vision',
      'awaiting_approval', 'manual'
    )
  );

comment on column public.grading_suggestions.ai_status is
  'pending → grading → graded | failed. Photos start at awaiting_approval (teacher checks the masked preview); manual = teacher chose not to send it to the AI. needs_vision = photo uploaded before masking existed.';
