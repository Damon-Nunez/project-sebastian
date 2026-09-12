/**
 * Lesson-plan image uploads (PNG/JPEG/WebP/GIF) → Supabase Storage
 * + section attachment metadata on lesson_plans.content.images.
 */
import { randomUUID } from "node:crypto";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  parseLessonPlanContent,
  type LessonPlanContent,
  type LessonPlanImage,
} from "./content";
import { imageSectionOptionsForContent } from "./imageSections";
import { getLessonPlanForTeacher, updateLessonPlanContent } from "./plans";

export { imageSectionOptionsForContent, imagesForSection } from "./imageSections";

export const LESSON_PLAN_IMAGES_BUCKET = "lesson-plan-images";
export const MAX_LESSON_IMAGE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export function isAllowedLessonImageMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime.toLowerCase());
}

export function extensionFor(mime: string, filename: string): string {
  const fromMime = EXT_BY_MIME[mime.toLowerCase()];
  if (fromMime) return fromMime;
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "bin";
}

export function buildLessonImageStoragePath(input: {
  teacherId: string;
  lessonPlanId: string;
  imageId: string;
  mimeType: string;
  originalFilename: string;
}): string {
  const ext = extensionFor(input.mimeType, input.originalFilename);
  return `${input.teacherId}/${input.lessonPlanId}/${input.imageId}.${ext}`;
}

export async function createSignedLessonImageUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage
    .from(LESSON_PLAN_IMAGES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    console.error("createSignedLessonImageUrl failed", error);
    return null;
  }
  return data.signedUrl;
}

export async function signLessonPlanImages(
  content: LessonPlanContent,
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  for (const image of content.images ?? []) {
    const url = await createSignedLessonImageUrl(image.storagePath);
    if (url) urls[image.id] = url;
  }
  return urls;
}

export type UploadLessonImageResult = {
  image: LessonPlanImage;
  signedUrl: string | null;
  content: LessonPlanContent;
};

export async function uploadLessonPlanImage(input: {
  teacherId: string;
  lessonPlanId: string;
  sectionKey: string;
  filename: string;
  mimeType: string;
  bytes: Buffer | Uint8Array;
  caption?: string;
  /** Prefer the live editor draft so unsaved field edits aren’t wiped. */
  draftContent?: LessonPlanContent;
}): Promise<UploadLessonImageResult> {
  const mime = input.mimeType.toLowerCase();
  if (!isAllowedLessonImageMime(mime)) {
    throw new Error("Unsupported image type. Use PNG, JPEG, WebP, or GIF.");
  }
  if (input.bytes.byteLength === 0) {
    throw new Error("Uploaded image is empty");
  }
  if (input.bytes.byteLength > MAX_LESSON_IMAGE_BYTES) {
    throw new Error("Image is too large (max 5MB)");
  }

  const plan = await getLessonPlanForTeacher(
    input.teacherId,
    input.lessonPlanId,
  );
  if (!plan) {
    throw new Error("Lesson plan not found");
  }

  const content = parseLessonPlanContent(
    input.draftContent ?? plan.content,
  );
  const allowed = new Set(
    imageSectionOptionsForContent(content).map((o) => o.key),
  );
  if (!allowed.has(input.sectionKey)) {
    throw new Error("Invalid image section");
  }

  const imageId = randomUUID();
  const storagePath = buildLessonImageStoragePath({
    teacherId: input.teacherId,
    lessonPlanId: input.lessonPlanId,
    imageId,
    mimeType: mime,
    originalFilename: input.filename,
  });

  const admin = createAdminSupabaseClient();
  const { error: uploadError } = await admin.storage
    .from(LESSON_PLAN_IMAGES_BUCKET)
    .upload(storagePath, input.bytes, {
      contentType: mime === "image/jpg" ? "image/jpeg" : mime,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Image upload failed: ${uploadError.message}`);
  }

  const image: LessonPlanImage = {
    id: imageId,
    sectionKey: input.sectionKey,
    storagePath,
    originalFilename: input.filename || `image.${extensionFor(mime, "x.png")}`,
    mimeType: mime === "image/jpg" ? "image/jpeg" : mime,
    caption: (input.caption ?? "").trim(),
  };

  const nextContent: LessonPlanContent = {
    ...content,
    images: [...(content.images ?? []), image],
  };

  const updated = await updateLessonPlanContent({
    teacherId: input.teacherId,
    lessonPlanId: input.lessonPlanId,
    content: nextContent,
  });

  const signedUrl = await createSignedLessonImageUrl(storagePath);

  return {
    image,
    signedUrl,
    content: parseLessonPlanContent(updated.content),
  };
}

export async function removeLessonPlanImage(input: {
  teacherId: string;
  lessonPlanId: string;
  imageId: string;
  draftContent?: LessonPlanContent;
}): Promise<LessonPlanContent> {
  const plan = await getLessonPlanForTeacher(
    input.teacherId,
    input.lessonPlanId,
  );
  if (!plan) {
    throw new Error("Lesson plan not found");
  }

  const content = parseLessonPlanContent(
    input.draftContent ?? plan.content,
  );
  const target = (content.images ?? []).find((img) => img.id === input.imageId);
  if (!target) {
    throw new Error("Image not found on this draft");
  }

  const admin = createAdminSupabaseClient();
  const { error: removeError } = await admin.storage
    .from(LESSON_PLAN_IMAGES_BUCKET)
    .remove([target.storagePath]);

  if (removeError) {
    console.error("Failed to delete lesson image from storage", removeError);
  }

  const nextContent: LessonPlanContent = {
    ...content,
    images: (content.images ?? []).filter((img) => img.id !== input.imageId),
  };

  const updated = await updateLessonPlanContent({
    teacherId: input.teacherId,
    lessonPlanId: input.lessonPlanId,
    content: nextContent,
  });

  return parseLessonPlanContent(updated.content);
}

/** Best-effort cleanup when a lesson draft is deleted. */
export async function deleteAllLessonPlanImages(input: {
  teacherId: string;
  lessonPlanId: string;
  content: unknown;
}): Promise<void> {
  let paths: string[] = [];
  try {
    const content = parseLessonPlanContent(input.content);
    paths = (content.images ?? []).map((img) => img.storagePath);
  } catch {
    return;
  }
  if (paths.length === 0) return;

  const admin = createAdminSupabaseClient();
  const { error } = await admin.storage
    .from(LESSON_PLAN_IMAGES_BUCKET)
    .remove(paths);
  if (error) {
    console.error("deleteAllLessonPlanImages failed", error);
  }
}
