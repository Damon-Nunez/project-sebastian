-- Ticket 10 / SCRUM-127: keep original homework uploads (docx / pdf / photos)
-- in a private bucket so vision grading can read them later.
-- Browser uploads go straight to Storage via signed upload URLs (bypasses the
-- Vercel request body limit); the server validates the extension before signing.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-work',
  'student-work',
  false,
  20971520,
  null
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- MVP uses the service_role admin client (bypasses RLS). No anon/authenticated
-- policies: the bucket stays closed to direct access.

alter table public.documents
  add column if not exists needs_vision boolean not null default false;

comment on column public.documents.needs_vision is
  'True when extracted text is empty/sparse (photo or scanned PDF); grading must use the stored image.';
