"use server";

import { getCurrentTeacher } from "@/lib/auth/teacher";
import { deleteStoredStudentWorkFiles } from "@/lib/grading/upload";
import { parseTeacherStoragePath } from "@/lib/grading/studentWorkFiles";
import { loadRubricPhotoImages, RubricPhotoReadError } from "@/lib/rubrics/loadRubricPhotoImages";
import { parseRubricPhotoFromImages } from "@/lib/rubrics/parseRubricPhoto";
import {
  MAX_RUBRIC_PHOTO_PAGES,
  RubricPhotoDraftError,
} from "@/lib/rubrics/rubricPhotoDraft";
import type { RubricCriteria } from "@/lib/rubrics/criteria";

export type ParseRubricPhotoResult =
  | { ok: true; name: string | null; criteria: RubricCriteria }
  | { ok: false; message: string };

async function discardUploads(teacherId: string, storagePaths: string[]) {
  const owned = storagePaths.filter(
    (storagePath) => parseTeacherStoragePath(teacherId, storagePath) !== null,
  );
  await deleteStoredStudentWorkFiles(
    owned.map((storage_path) => ({ storage_path })),
  );
}

/** Drop temporary rubric photos when reading stops before a parse. */
export async function discardRubricPhotoUploadsAction(storagePaths: string[]) {
  const teacher = await getCurrentTeacher();
  const paths = Array.isArray(storagePaths)
    ? storagePaths.filter((path): path is string => typeof path === "string")
    : [];
  await discardUploads(teacher.id, paths);
}

/**
 * Fill the rubric editor from a photo or scan. Does not save the rubric.
 * Uploaded bytes are removed after the read, whether or not parsing works.
 */
export async function parseRubricPhotoAction(input: {
  files: Array<{ storagePath: string; filename: string }>;
}): Promise<ParseRubricPhotoResult> {
  const teacher = await getCurrentTeacher();
  const files = Array.isArray(input?.files) ? input.files : [];
  const paths = files
    .map((file) => (typeof file?.storagePath === "string" ? file.storagePath : ""))
    .filter(Boolean);

  if (files.length === 0 || paths.length !== files.length) {
    await discardUploads(teacher.id, paths);
    return { ok: false, message: "Choose a rubric photo or scan." };
  }
  if (files.length > MAX_RUBRIC_PHOTO_PAGES) {
    await discardUploads(teacher.id, paths);
    return {
      ok: false,
      message: `That's too many pages at once (max ${MAX_RUBRIC_PHOTO_PAGES}).`,
    };
  }

  try {
    const images = await loadRubricPhotoImages({
      teacherId: teacher.id,
      files: files.map((file, index) => ({
        storagePath: paths[index]!,
        filename: typeof file.filename === "string" ? file.filename : "rubric",
      })),
    });
    const parsed = await parseRubricPhotoFromImages({
      teacherId: teacher.id,
      images,
    });
    return { ok: true, name: parsed.name, criteria: parsed.criteria };
  } catch (error) {
    if (
      error instanceof RubricPhotoReadError ||
      error instanceof RubricPhotoDraftError
    ) {
      return { ok: false, message: error.message };
    }
    console.error("parseRubricPhotoAction failed", error);
    return {
      ok: false,
      message: "Couldn't read that rubric. Try a clearer photo, or type it in.",
    };
  } finally {
    await discardUploads(teacher.id, paths);
  }
}
