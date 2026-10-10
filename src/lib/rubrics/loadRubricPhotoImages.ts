/**
 * Read a temporary rubric photo upload into JPEG pages for the vision call.
 * Bytes stay in memory. The caller deletes the Storage object afterward.
 */
import type { TeacherAssetImage } from "@/lib/ai/createAiMessage";
import { normalizeHomeworkImage } from "@/lib/grading/upload";
import { renderPdfPages } from "@/lib/grading/vision";
import {
  isImageFormat,
  parseTeacherStoragePath,
  STUDENT_WORK_BUCKET,
} from "@/lib/grading/studentWorkFiles";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { MAX_RUBRIC_PHOTO_PAGES } from "./rubricPhotoDraft";

const MAX_AI_EDGE_PX = 1568;

export class RubricPhotoReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RubricPhotoReadError";
  }
}

async function toAiJpeg(jpeg: Buffer): Promise<TeacherAssetImage> {
  const { default: sharp } = await import("sharp");
  const resized = await sharp(jpeg)
    .resize({
      width: MAX_AI_EDGE_PX,
      height: MAX_AI_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { mediaType: "image/jpeg", base64: resized.toString("base64") };
}

export async function loadRubricPhotoImages(input: {
  teacherId: string;
  files: Array<{ storagePath: string; filename: string }>;
}): Promise<TeacherAssetImage[]> {
  const admin = createAdminSupabaseClient();
  const pages: Buffer[] = [];

  for (const file of input.files) {
    const format = parseTeacherStoragePath(input.teacherId, file.storagePath);
    if (!format || format === "docx") {
      throw new RubricPhotoReadError(
        "Upload a photo or scan (.jpg, .png, .heic, or .pdf).",
      );
    }

    const { data, error } = await admin.storage
      .from(STUDENT_WORK_BUCKET)
      .download(file.storagePath);
    if (error || !data) {
      throw new RubricPhotoReadError("Upload didn't finish. Try that photo again.");
    }
    const bytes = Buffer.from(await data.arrayBuffer());

    if (isImageFormat(format)) {
      pages.push(await normalizeHomeworkImage(bytes, format));
    } else {
      const rendered = await renderPdfPages(bytes);
      if (rendered.length === 0) {
        throw new RubricPhotoReadError("That PDF had no pages to read.");
      }
      pages.push(...rendered);
    }
  }

  if (pages.length === 0) {
    throw new RubricPhotoReadError(
      "Couldn't read that rubric. Try a clearer photo, or type it in.",
    );
  }
  if (pages.length > MAX_RUBRIC_PHOTO_PAGES) {
    throw new RubricPhotoReadError(
      `That rubric is too many pages (max ${MAX_RUBRIC_PHOTO_PAGES}).`,
    );
  }

  return Promise.all(pages.map((page) => toAiJpeg(page)));
}
