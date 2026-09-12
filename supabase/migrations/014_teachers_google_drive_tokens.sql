-- SCRUM-86 / 2.4: persist Google provider tokens for Drive upload
alter table public.teachers
  add column if not exists google_access_token text,
  add column if not exists google_refresh_token text,
  add column if not exists google_token_expires_at timestamptz;

comment on column public.teachers.google_access_token is
  'Google OAuth access token for Drive (server-only; not selected for UI).';
comment on column public.teachers.google_refresh_token is
  'Google OAuth refresh token for Drive (server-only; not selected for UI).';
comment on column public.teachers.google_token_expires_at is
  'When google_access_token is expected to expire; refresh before then.';
