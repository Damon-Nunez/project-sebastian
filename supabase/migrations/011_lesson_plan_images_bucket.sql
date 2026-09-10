-- Lesson plan images: private Storage bucket for teacher uploads (PNG/JPEG/WebP/GIF).
-- Metadata lives in lesson_plans.content.images; bytes live here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-plan-images',
  'lesson-plan-images',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- MVP uses the service_role admin client (bypasses RLS). Policies keep the
-- bucket closed to anon/authenticated direct access.

drop policy if exists "lesson_plan_images_no_public_select" on storage.objects;
drop policy if exists "lesson_plan_images_no_public_insert" on storage.objects;
drop policy if exists "lesson_plan_images_no_public_update" on storage.objects;
drop policy if exists "lesson_plan_images_no_public_delete" on storage.objects;
