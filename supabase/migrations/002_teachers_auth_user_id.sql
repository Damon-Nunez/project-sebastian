-- Ticket 1: link teachers row to Supabase Auth user (Google OAuth)
alter table public.teachers
  add column if not exists auth_user_id uuid unique references auth.users (id) on delete set null;

create index if not exists teachers_auth_user_id_idx
  on public.teachers (auth_user_id);

comment on column public.teachers.auth_user_id is
  'Supabase Auth user id from Google OAuth. Nullable until first successful login.';
