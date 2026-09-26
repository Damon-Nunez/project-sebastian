/**
 * Pure helpers for student-work uploads (Ticket 10 / SCRUM-127):
 * accepted formats, private Storage paths, and the "needs vision" rule.
 */

export type HomeworkFormat = "docx" | "pdf" | "jpeg" | "png" | "heic";

export const STUDENT_WORK_BUCKET = "student-work";
export const MAX_HOMEWORK_BYTES = 20 * 1024 * 1024;

/** Below this many non-whitespace characters, text grading is unreliable. */
export const MIN_TEXT_CHARS_FOR_TEXT_GRADING = 40;

export const HOMEWORK_ACCEPT =
  ".docx,.pdf,.jpg,.jpeg,.png,.heic,.heif,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/heic,image/heif";

const FORMAT_BY_EXTENSION: Record<string, HomeworkFormat> = {
  docx: "docx",
  pdf: "pdf",
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  heic: "heic",
  heif: "heic",
};

const STORAGE_EXTENSION: Record<HomeworkFormat, string> = {
  docx: "docx",
  pdf: "pdf",
  jpeg: "jpg",
  png: "png",
  heic: "heic",
};

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const STORAGE_PATH_PATTERN = new RegExp(
  `^(${UUID})/(${UUID})\\.(docx|pdf|jpg|png|heic)$`,
  "i",
);

function extensionOf(filename: string | null | undefined): string {
  const match = (filename ?? "").trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function detectHomeworkFormat(
  filename: string | null | undefined,
): HomeworkFormat | null {
  return FORMAT_BY_EXTENSION[extensionOf(filename)] ?? null;
}

export function isImageFormat(format: HomeworkFormat): boolean {
  return format === "jpeg" || format === "png" || format === "heic";
}

export function buildStudentWorkStoragePath(input: {
  teacherId: string;
  fileId: string;
  format: HomeworkFormat;
}): string {
  return `${input.teacherId}/${input.fileId}.${STORAGE_EXTENSION[input.format]}`;
}

/** Normalized photos are always stored as JPEG next to the original path. */
export function jpegPathFor(storagePath: string): string {
  return storagePath.replace(/\.[a-z0-9]+$/i, ".jpg");
}

/**
 * Parse a client-supplied storage path and confirm it is a path we would
 * have signed for this teacher. Returns the format, or null if not trusted.
 */
export function parseTeacherStoragePath(
  teacherId: string,
  storagePath: string,
): HomeworkFormat | null {
  const match = storagePath.match(STORAGE_PATH_PATTERN);
  if (!match || match[1].toLowerCase() !== teacherId.toLowerCase()) {
    return null;
  }
  return detectHomeworkFormat(storagePath);
}

export function needsVisionForText(text: string | null | undefined): boolean {
  const visible = (text ?? "").replace(/\s+/g, "");
  return visible.length < MIN_TEXT_CHARS_FOR_TEXT_GRADING;
}
