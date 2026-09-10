"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  EmptyFrameworkTextError,
  UnsupportedFrameworkFormatError,
} from "@/lib/lessons/extract";
import { parseLessonPlanContent } from "@/lib/lessons/content";
import type { LessonErrorCode } from "@/lib/lessons/errors";
import {
  createLessonPlanFromFrameworkUpload,
  deleteLessonPlanForTeacher,
  updateLessonPlanContent,
} from "@/lib/lessons/plans";
import {
  isAllowedLessonImageMime,
  MAX_LESSON_IMAGE_BYTES,
  removeLessonPlanImage,
  uploadLessonPlanImage,
} from "@/lib/lessons/images";
import {
  removeLessonWorksheet,
  uploadLessonWorksheet,
} from "@/lib/lessons/worksheets";
import type { LessonWorksheetRow } from "@/lib/db/types";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function redirectLessonsError(code: LessonErrorCode): never {
  redirect(`/lessons?error=${code}`);
}

function redirectLessonError(lessonId: string, code: LessonErrorCode): never {
  redirect(`/lessons/${lessonId}?error=${code}`);
}

export async function uploadFrameworkAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirectLessonsError("missing_file");
  }

  const filename = file.name || "framework.bin";
  const bytes = Buffer.from(await file.arrayBuffer());

  let planId: string;
  try {
    const { plan } = await createLessonPlanFromFrameworkUpload({
      teacherId: teacher.id,
      filename,
      bytes,
    });
    planId = plan.id;
  } catch (error) {
    if (error instanceof UnsupportedFrameworkFormatError) {
      redirectLessonsError("invalid_format");
    }
    if (error instanceof EmptyFrameworkTextError) {
      redirectLessonsError("empty_text");
    }
    console.error("uploadFrameworkAction failed", error);
    redirectLessonsError("upload_failed");
  }

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${planId}`);
  redirect(`/lessons/${planId}`);
}

export async function saveLessonPlanAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  if (!lessonId) {
    redirectLessonsError("missing_lesson");
  }

  let content;
  try {
    content = parseLessonPlanContent(
      JSON.parse(formString(formData, "contentJson")),
    );
  } catch {
    redirectLessonError(lessonId, "invalid_save");
  }

  try {
    await updateLessonPlanContent({
      teacherId: teacher.id,
      lessonPlanId: lessonId,
      content,
      freeTextAsks: formString(formData, "freeTextAsks"),
      moduleLabel: formString(formData, "moduleLabel"),
      unitLabel: formString(formData, "unitLabel"),
      lessonLabel: formString(formData, "lessonLabel"),
    });
  } catch (error) {
    console.error("saveLessonPlanAction failed", error);
    redirectLessonError(lessonId, "save_failed");
  }

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${lessonId}`);
  redirect(`/lessons/${lessonId}?saved=1`);
}

export async function deleteLessonPlanAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  if (!lessonId) {
    redirectLessonsError("missing_lesson");
  }

  try {
    await deleteLessonPlanForTeacher(teacher.id, lessonId);
  } catch (error) {
    console.error("deleteLessonPlanAction failed", error);
    redirectLessonsError("delete_failed");
  }

  revalidatePath("/lessons");
  redirect("/lessons");
}

export type LessonImageActionResult =
  | {
      ok: true;
      imageId?: string;
      signedUrl?: string | null;
      content: ReturnType<typeof parseLessonPlanContent>;
    }
  | { ok: false; error: LessonErrorCode };

export async function uploadLessonImageAction(
  formData: FormData,
): Promise<LessonImageActionResult> {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  const sectionKey = formString(formData, "sectionKey").trim();
  const caption = formString(formData, "caption").trim();
  const file = formData.get("file");

  if (!lessonId) {
    return { ok: false, error: "missing_lesson" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "missing_image" };
  }
  if (!sectionKey) {
    return { ok: false, error: "invalid_image_section" };
  }
  if (!isAllowedLessonImageMime(file.type || "")) {
    return { ok: false, error: "invalid_image" };
  }
  if (file.size > MAX_LESSON_IMAGE_BYTES) {
    return { ok: false, error: "image_too_large" };
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    let draftContent;
    try {
      const raw = formString(formData, "contentJson");
      if (raw) draftContent = parseLessonPlanContent(JSON.parse(raw));
    } catch {
      draftContent = undefined;
    }

    const result = await uploadLessonPlanImage({
      teacherId: teacher.id,
      lessonPlanId: lessonId,
      sectionKey,
      filename: file.name || "image.png",
      mimeType: file.type,
      bytes,
      caption,
      draftContent,
    });
    revalidatePath(`/lessons/${lessonId}`);
    return {
      ok: true,
      imageId: result.image.id,
      signedUrl: result.signedUrl,
      content: result.content,
    };
  } catch (error) {
    console.error("uploadLessonImageAction failed", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Invalid image section")) {
      return { ok: false, error: "invalid_image_section" };
    }
    if (message.includes("Unsupported image")) {
      return { ok: false, error: "invalid_image" };
    }
    if (message.includes("too large")) {
      return { ok: false, error: "image_too_large" };
    }
    if (message.includes("not found")) {
      return { ok: false, error: "missing_lesson" };
    }
    return { ok: false, error: "image_upload_failed" };
  }
}

export async function removeLessonImageAction(
  formData: FormData,
): Promise<LessonImageActionResult> {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  const imageId = formString(formData, "imageId").trim();

  if (!lessonId) {
    return { ok: false, error: "missing_lesson" };
  }
  if (!imageId) {
    return { ok: false, error: "image_remove_failed" };
  }

  try {
    let draftContent;
    try {
      const raw = formString(formData, "contentJson");
      if (raw) draftContent = parseLessonPlanContent(JSON.parse(raw));
    } catch {
      draftContent = undefined;
    }

    const content = await removeLessonPlanImage({
      teacherId: teacher.id,
      lessonPlanId: lessonId,
      imageId,
      draftContent,
    });
    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true, content };
  } catch (error) {
    console.error("removeLessonImageAction failed", error);
    return { ok: false, error: "image_remove_failed" };
  }
}

export type LessonWorksheetActionResult =
  | {
      ok: true;
      worksheet?: LessonWorksheetRow;
      signedUrl?: string | null;
      worksheets?: LessonWorksheetRow[];
    }
  | { ok: false; error: LessonErrorCode };

export async function uploadLessonWorksheetAction(
  formData: FormData,
): Promise<LessonWorksheetActionResult> {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  const caption = formString(formData, "caption").trim();
  const file = formData.get("file");

  if (!lessonId) {
    return { ok: false, error: "missing_lesson" };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "missing_image" };
  }
  if (!isAllowedLessonImageMime(file.type || "")) {
    return { ok: false, error: "invalid_image" };
  }
  if (file.size > MAX_LESSON_IMAGE_BYTES) {
    return { ok: false, error: "image_too_large" };
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { row, signedUrl } = await uploadLessonWorksheet({
      teacherId: teacher.id,
      lessonPlanId: lessonId,
      filename: file.name || "worksheet.png",
      mimeType: file.type,
      bytes,
      caption,
    });
    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true, worksheet: row, signedUrl };
  } catch (error) {
    console.error("uploadLessonWorksheetAction failed", error);
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not found")) {
      return { ok: false, error: "missing_lesson" };
    }
    return { ok: false, error: "worksheet_upload_failed" };
  }
}

export async function removeLessonWorksheetAction(
  formData: FormData,
): Promise<LessonWorksheetActionResult> {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  const worksheetId = formString(formData, "worksheetId").trim();

  if (!lessonId) {
    return { ok: false, error: "missing_lesson" };
  }
  if (!worksheetId) {
    return { ok: false, error: "worksheet_remove_failed" };
  }

  try {
    await removeLessonWorksheet({
      teacherId: teacher.id,
      lessonPlanId: lessonId,
      worksheetId,
    });
    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true };
  } catch (error) {
    console.error("removeLessonWorksheetAction failed", error);
    return { ok: false, error: "worksheet_remove_failed" };
  }
}
