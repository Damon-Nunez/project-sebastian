-- Ticket 2.6: RLS on domain tables — anon/authenticated denied; service_role bypasses
-- App continues to use the server admin client for MVP. Full teacher-scoped policies later.

alter table public.teachers enable row level security;
alter table public.sections enable row level security;
alter table public.students enable row level security;
alter table public.units enable row level security;
alter table public.rubrics enable row level security;
alter table public.lesson_plans enable row level security;
alter table public.documents enable row level security;
alter table public.grading_sessions enable row level security;
alter table public.grading_suggestions enable row level security;
