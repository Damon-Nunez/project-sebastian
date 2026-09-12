-- SCRUM-87 / 2.5: cache app-created Sebastian Drive folder per teacher
alter table public.teachers
  add column if not exists google_drive_folder_id text;

comment on column public.teachers.google_drive_folder_id is
  'Google Drive folder id for the app-created Sebastian folder (server-only).';
