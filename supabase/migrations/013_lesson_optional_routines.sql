-- Optional discussion routines (Turn and Talk, later Think-Pair-Share).
-- Unused / opted-out drafts keep {}.

alter table public.lesson_plans
  add column if not exists optional_routines jsonb not null default '{}'::jsonb;

comment on column public.lesson_plans.optional_routines is
  'Optional discussion routines for polish (e.g. turnAndTalk: targetSectionKey, placement, prompts). Empty {} when unused.';
