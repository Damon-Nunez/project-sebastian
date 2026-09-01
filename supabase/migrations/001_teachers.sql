-- Ticket 0.4: stub teachers table for future BYOK / usage tracking
create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  api_key_encrypted text,
  usage_tokens bigint default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.teachers is 'Single-teacher MVP stub; multi-tenant isolation added later.';
comment on column public.teachers.api_key_encrypted is 'Future: teacher BYOK encrypted key. Nullable for MVP.';
comment on column public.teachers.usage_tokens is 'Future: track app-key usage per teacher. Unused in MVP.';
