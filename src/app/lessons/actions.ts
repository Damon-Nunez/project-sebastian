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
import { isAnthropicConfigured } from "@/lib/env";
import {
  createLessonPlanFromFrameworkUpload,
  deleteLessonPlanForTeacher,
  updateLessonPlanContent,
  updateLessonPlanStatus,
} from "@/lib/lessons/plans";
import { polishAndSaveLessonPlan } from "@/lib/lessons/polishAndSaveLessonPlan";
import { parseSectionGroups } from "@/lib/lessons/sectionGroups";
import {
  isAllowedLessonImageMime,
  MAX_LESSON_IMAGE_BYTES,
  removeLessonPlanImage,
  uploadLessonPlanImage,
} from "@/lib/lessons/images";
import {
  addLessonPlanLink,
  InvalidLessonLinkError,
  removeLessonPlanLink,
} from "@/lib/lessons/links";

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

  const sectionGroupsRaw = formString(formData, "sectionGroupsJson");
  let sectionGroups;
  if (sectionGroupsRaw.length > 0) {
    try {
      sectionGroups = parseSectionGroups(JSON.parse(sectionGroupsRaw));
    } catch {
      redirectLessonError(lessonId, "invalid_save");
    }
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
      ...(sectionGroups !== undefined ? { sectionGroups } : {}),
    });
  } catch (error) {
    console.error("saveLessonPlanAction failed", error);
    redirectLessonError(lessonId, "save_failed");
  }

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${lessonId}`);
  redirect(`/lessons/${lessonId}?saved=1`);
}

/**
 * Trax 2.1 — sanitized middleman polish. Saves Edited bodies; does not mark final.
 */
export async function polishLessonPlanAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  if (!lessonId) {
    redirectLessonsError("missing_lesson");
  }

  if (!isAnthropicConfigured()) {
    redirectLessonError(lessonId, "polish_unavailable");
  }

  let content;
  try {
    content = parseLessonPlanContent(
      JSON.parse(formString(formData, "contentJson")),
    );
  } catch {
    redirectLessonError(lessonId, "invalid_save");
  }

  const sectionGroupsRaw = formString(formData, "sectionGroupsJson");
  let sectionGroups;
  if (sectionGroupsRaw.length > 0) {
    try {
      sectionGroups = parseSectionGroups(JSON.parse(sectionGroupsRaw));
    } catch {
      redirectLessonError(lessonId, "invalid_save");
    }
  }

  try {
    await polishAndSaveLessonPlan({
      teacherId: teacher.id,
      lessonPlanId: lessonId,
      content,
      freeTextAsks: formString(formData, "freeTextAsks"),
      moduleLabel: formString(formData, "moduleLabel"),
      unitLabel: formString(formData, "unitLabel"),
      lessonLabel: formString(formData, "lessonLabel"),
      ...(sectionGroups !== undefined ? { sectionGroups } : {}),
    });
  } catch (error) {
    console.error("polishLessonPlanAction failed", error);
    redirectLessonError(lessonId, "polish_failed");
  }

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${lessonId}`);
  redirect(`/lessons/${lessonId}?polished=1`);
}

/** Trax 2.3 — move plan into Sebastian Local Save (FINISHED). */
export async function finalizeLessonPlanAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  if (!lessonId) {
    redirectLessonsError("missing_lesson");
  }

  // Persist latest editor fields first so FINISHED matches what she sees.
  let content;
  try {
    content = parseLessonPlanContent(
      JSON.parse(formString(formData, "contentJson")),
    );
  } catch {
    redirectLessonError(lessonId, "invalid_save");
  }

  const sectionGroupsRaw = formString(formData, "sectionGroupsJson");
  let sectionGroups;
  if (sectionGroupsRaw.length > 0) {
    try {
      sectionGroups = parseSectionGroups(JSON.parse(sectionGroupsRaw));
    } catch {
      redirectLessonError(lessonId, "invalid_save");
    }
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
      ...(sectionGroups !== undefined ? { sectionGroups } : {}),
    });
    await updateLessonPlanStatus({
      teacherId: teacher.id,
      lessonPlanId: lessonId,
      status: "final",
    });
  } catch (error) {
    console.error("finalizeLessonPlanAction failed", error);
    redirectLessonError(lessonId, "finalize_failed");
  }

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${lessonId}`);
  redirect(`/lessons/${lessonId}?finished=1`);
}

/** Move a finished plan back to drafts for more edits. */
export async function reopenLessonPlanAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  if (!lessonId) {
    redirectLessonsError("missing_lesson");
  }

  try {
    await updateLessonPlanStatus({
      teacherId: teacher.id,
      lessonPlanId: lessonId,
      status: "draft",
    });
  } catch (error) {
    console.error("reopenLessonPlanAction failed", error);
    redirectLessonError(lessonId, "reopen_failed");
  }

  revalidatePath("/lessons");
  revalidatePath(`/lessons/${lessonId}`);
  redirect(`/lessons/${lessonId}?reopened=1`);
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

export type LessonLinkActionResult =
  | {
      ok: true;
      linkId?: string;
      content: ReturnType<typeof parseLessonPlanContent>;
    }
  | { ok: false; error: LessonErrorCode };

export async function addLessonPlanLinkAction(
  formData: FormData,
): Promise<LessonLinkActionResult> {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  const sectionKey = formString(formData, "sectionKey").trim();
  const caption = formString(formData, "caption").trim();
  const url = formString(formData, "url").trim();

  if (!lessonId) {
    return { ok: false, error: "missing_lesson" };
  }
  if (!url) {
    return { ok: false, error: "missing_link" };
  }
  if (!sectionKey) {
    return { ok: false, error: "invalid_link_section" };
  }

  try {
    let draftContent;
    try {
      const raw = formString(formData, "contentJson");
      if (raw) draftContent = parseLessonPlanContent(JSON.parse(raw));
    } catch {
      draftContent = undefined;
    }

    const result = await addLessonPlanLink({
      teacherId: teacher.id,
      lessonPlanId: lessonId,
      url,
      sectionKey,
      caption,
      draftContent,
    });
    revalidatePath(`/lessons/${lessonId}`);
    return {
      ok: true,
      linkId: result.link.id,
      content: result.content,
    };
  } catch (error) {
    console.error("addLessonPlanLinkAction failed", error);
    if (error instanceof InvalidLessonLinkError) {
      return { ok: false, error: "invalid_link" };
    }
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Invalid link section")) {
      return { ok: false, error: "invalid_link_section" };
    }
    if (message.includes("not found")) {
      return { ok: false, error: "missing_lesson" };
    }
    return { ok: false, error: "link_add_failed" };
  }
}

export async function removeLessonPlanLinkAction(
  formData: FormData,
): Promise<LessonLinkActionResult> {
  const teacher = await getCurrentTeacher();
  const lessonId = formString(formData, "lessonId");
  const linkId = formString(formData, "linkId").trim();

  if (!lessonId) {
    return { ok: false, error: "missing_lesson" };
  }
  if (!linkId) {
    return { ok: false, error: "link_remove_failed" };
  }

  try {
    let draftContent;
    try {
      const raw = formString(formData, "contentJson");
      if (raw) draftContent = parseLessonPlanContent(JSON.parse(raw));
    } catch {
      draftContent = undefined;
    }

    const content = await removeLessonPlanLink({
      teacherId: teacher.id,
      lessonPlanId: lessonId,
      linkId,
      draftContent,
    });
    revalidatePath(`/lessons/${lessonId}`);
    return { ok: true, content };
  } catch (error) {
    console.error("removeLessonPlanLinkAction failed", error);
    return { ok: false, error: "link_remove_failed" };
  }
}
