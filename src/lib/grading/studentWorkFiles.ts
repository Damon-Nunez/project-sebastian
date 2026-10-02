/**
 * Pure helpers for student-work uploads (Ticket 10 / SCRUM-127):
 * accepted formats, private Storage paths, and the "needs vision" rule.
 */

export type HomeworkFormat = "docx" | "pdf" | "jpeg" | "png" | "heic";

export const STUDENT_WORK_BUCKET = "student-work";
export const MAX_HOMEWORK_BYTES = 20 * 1024 * 1024;
export const MAX_BATCH_FILES = 60;

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

/** One photo / scanned page (documents.vision_pages, migration 024). */
export type VisionPage = {
  originalPath: string;
  /** The only image that may be sent to the AI. */
  maskedPath: string;
  width: number;
  height: number;
  headerStrip: boolean;
  /** Roster names + "Name" lines blacked out; 0 means OCR found none. */
  nameBoxes: number;
};

/** Scanned PDFs beyond this many pages are graded on the first pages only. */
export const MAX_VISION_PAGES = 6;

export function parseVisionPages(raw: unknown): VisionPage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (page): page is VisionPage =>
      typeof page === "object" &&
      page !== null &&
      typeof page.originalPath === "string" &&
      typeof page.maskedPath === "string" &&
      typeof page.width === "number" &&
      typeof page.height === "number" &&
      typeof page.headerStrip === "boolean" &&
      typeof page.nameBoxes === "number",
  );
}

/** Rendered / masked page files sit next to the upload: `<id>.p1.jpg`, `<id>.p1.masked.jpg`. */
export function visionPagePaths(
  storagePath: string,
  pageNumber: number,
): { originalPath: string; maskedPath: string } {
  const base = storagePath.replace(/\.[a-z0-9]+$/i, "");
  return {
    originalPath: `${base}.p${pageNumber}.jpg`,
    maskedPath: `${base}.p${pageNumber}.masked.jpg`,
  };
}

/** Every Storage file behind a student_work row (upload + page images). */
export function studentWorkStoragePaths(row: {
  storage_path: string | null;
  vision_pages?: unknown;
}): string[] {
  const paths = new Set<string>();
  if (row.storage_path) paths.add(row.storage_path);
  for (const page of parseVisionPages(row.vision_pages)) {
    paths.add(page.originalPath);
    paths.add(page.maskedPath);
  }
  return [...paths];
}
