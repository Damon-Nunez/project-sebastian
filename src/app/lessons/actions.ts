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
  updateLessonPlanContent,
} from "@/lib/lessons/plans";

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
