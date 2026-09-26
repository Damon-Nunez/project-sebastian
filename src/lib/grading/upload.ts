import { randomUUID } from "node:crypto";
import type { DocumentRow } from "@/lib/db/types";
import {
  EmptyFrameworkTextError,
  extractDocxText,
  extractPdfText,
  UnsupportedFrameworkFormatError,
} from "@/lib/lessons/extract";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  buildStudentWorkStoragePath,
  detectHomeworkFormat,
  isImageFormat,
  jpegPathFor,
  MAX_HOMEWORK_BYTES,
  needsVisionForText,
  parseTeacherStoragePath,
  STUDENT_WORK_BUCKET,
  type HomeworkFormat,
} from "./studentWorkFiles";

const DOCUMENT_SELECT =
  "id, teacher_id, kind, original_filename, storage_path, lesson_plan_id, grading_session_id, student_id, body_text, needs_vision, created_at, updated_at";

/** Long edge for stored photos — enough for vision grading, small enough to stay cheap. */
const MAX_IMAGE_EDGE_PX = 2000;

export { MAX_HOMEWORK_BYTES };

export {
  EmptyFrameworkTextError as EmptyHomeworkTextError,
  UnsupportedFrameworkFormatError as UnsupportedHomeworkFormatError,
};

export class HomeworkTooLargeError extends Error {
  constructor() {
    super("Homework file is too large");
    this.name = "HomeworkTooLargeError";
  }
}

export type HomeworkUploadResult = {
  document: DocumentRow;
};

export type HomeworkUploadTarget = {
  storagePath: string;
  token: string;
};

/**
 * Step 1 of an upload: validate the file name/size and sign a one-time
 * upload URL so the browser sends bytes straight to Storage (not via Vercel).
 */
export async function createStudentWorkUploadTarget(input: {
  teacherId: string;
  filename: string;
  size: number;
}): Promise<HomeworkUploadTarget> {
  const format = detectHomeworkFormat(input.filename);
  if (!format) {
    throw new UnsupportedFrameworkFormatError(input.filename);
  }
  if (input.size > MAX_HOMEWORK_BYTES) {
    throw new HomeworkTooLargeError();
  }

  const storagePath = buildStudentWorkStoragePath({
    teacherId: input.teacherId,
    fileId: randomUUID(),
    format,
  });

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage
    .from(STUDENT_WORK_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    throw new Error(
      `Failed to sign homework upload: ${error?.message ?? "unknown error"}`,
    );
  }

  return { storagePath, token: data.token };
}

async function normalizeHomeworkImage(
  bytes: Buffer,
  format: HomeworkFormat,
): Promise<Buffer> {
  let input = bytes;
  if (format === "heic") {
    const { default: convertHeic } = await import("heic-convert");
    const jpeg = await convertHeic({
      buffer: bytes as unknown as ArrayBufferLike,
      format: "JPEG",
      quality: 0.9,
    });
    input = Buffer.from(jpeg);
  }

  const { default: sharp } = await import("sharp");
  return sharp(input)
    .rotate()
    .resize({
      width: MAX_IMAGE_EDGE_PX,
      height: MAX_IMAGE_EDGE_PX,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}

type PreparedStudentWork = {
  storagePath: string;
  bodyText: string | null;
  needsVision: boolean;
};

async function prepareStoredStudentWork(input: {
  storagePath: string;
  format: HomeworkFormat;
  bytes: Buffer;
}): Promise<PreparedStudentWork> {
  const admin = createAdminSupabaseClient();

  if (isImageFormat(input.format)) {
    const jpeg = await normalizeHomeworkImage(input.bytes, input.format);
    const storagePath = jpegPathFor(input.storagePath);
    const { error } = await admin.storage
      .from(STUDENT_WORK_BUCKET)
      .upload(storagePath, jpeg, { contentType: "image/jpeg", upsert: true });
    if (error) {
      throw new Error(`Failed to store normalized photo: ${error.message}`);
    }
    if (storagePath !== input.storagePath) {
      await admin.storage.from(STUDENT_WORK_BUCKET).remove([input.storagePath]);
    }
    return { storagePath, bodyText: null, needsVision: true };
  }

  if (input.format === "docx") {
    const text = await extractDocxText(input.bytes);
    return { storagePath: input.storagePath, bodyText: text, needsVision: false };
  }

  let text = "";
  try {
    text = await extractPdfText(input.bytes);
  } catch (error) {
    if (!(error instanceof EmptyFrameworkTextError)) throw error;
  }
  return {
    storagePath: input.storagePath,
    bodyText: text || null,
    needsVision: needsVisionForText(text),
  };
}

async function removeStoredStudentWork(paths: string[]): Promise<void> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return;
  const admin = createAdminSupabaseClient();
  const { error } = await admin.storage.from(STUDENT_WORK_BUCKET).remove(unique);
  if (error) {
    console.error("removeStoredStudentWork failed", error);
  }
}

/**
 * Step 2 of an upload: read the bytes the browser put in Storage, normalize
 * photos, extract text (or flag needs_vision), and create the student_work row.
 * grading_session_id stays null until the teacher saves into an assignment folder.
 */
export async function finalizeStudentWorkUpload(input: {
  teacherId: string;
  storagePath: string;
  filename: string;
}): Promise<HomeworkUploadResult> {
  const format = parseTeacherStoragePath(input.teacherId, input.storagePath);
  if (!format) {
    throw new UnsupportedFrameworkFormatError(input.filename);
  }

  const admin = createAdminSupabaseClient();
  const { data: blob, error: downloadError } = await admin.storage
    .from(STUDENT_WORK_BUCKET)
    .download(input.storagePath);

  if (downloadError || !blob) {
    throw new Error(
      `Uploaded homework not found in storage: ${downloadError?.message ?? "missing"}`,
    );
  }

  const bytes = Buffer.from(await blob.arrayBuffer());
  let prepared: PreparedStudentWork | null = null;

  try {
    if (bytes.byteLength === 0) {
      throw new Error("Homework file is empty");
    }
    if (bytes.byteLength > MAX_HOMEWORK_BYTES) {
      throw new HomeworkTooLargeError();
    }

    prepared = await prepareStoredStudentWork({
      storagePath: input.storagePath,
      format,
      bytes,
    });

    const { data, error } = await admin
      .from("documents")
      .insert({
        teacher_id: input.teacherId,
        kind: "student_work",
        original_filename: input.filename,
        storage_path: prepared.storagePath,
        lesson_plan_id: null,
        grading_session_id: null,
        student_id: null,
        body_text: prepared.bodyText,
        needs_vision: prepared.needsVision,
        updated_at: new Date().toISOString(),
      })
      .select(DOCUMENT_SELECT)
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to save homework document: ${error?.message ?? "unknown error"}`,
      );
    }

    return { document: data as DocumentRow };
  } catch (error) {
    await removeStoredStudentWork([
      input.storagePath,
      prepared?.storagePath ?? "",
    ]);
    throw error;
  }
}

/**
 * Extract text from a .docx / .pdf the browser already put in Storage
 * (assignment answer keys / exemplars). Photos are rejected until vision (2.6).
 * The stored file is removed if it can't be used.
 */
export async function extractStoredDocumentText(input: {
  teacherId: string;
  storagePath: string;
  filename: string;
}): Promise<string> {
  const format = parseTeacherStoragePath(input.teacherId, input.storagePath);
  if (!format || isImageFormat(format)) {
    await removeStoredStudentWork(format ? [input.storagePath] : []);
    throw new UnsupportedFrameworkFormatError(
      input.filename,
      "Upload the answer key or example as a .docx or .pdf, or paste the text.",
    );
  }

  const admin = createAdminSupabaseClient();
  const { data: blob, error } = await admin.storage
    .from(STUDENT_WORK_BUCKET)
    .download(input.storagePath);
  if (error || !blob) {
    throw new Error(
      `Uploaded file not found in storage: ${error?.message ?? "missing"}`,
    );
  }

  try {
    const bytes = Buffer.from(await blob.arrayBuffer());
    return format === "docx"
      ? await extractDocxText(bytes)
      : await extractPdfText(bytes);
  } catch (extractError) {
    await removeStoredStudentWork([input.storagePath]);
    throw extractError;
  }
}

export async function createSignedStudentWorkUrl(
  storagePath: string,
  expiresInSeconds = 10 * 60,
): Promise<string | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin.storage
    .from(STUDENT_WORK_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) {
    console.error("createSignedStudentWorkUrl failed", error);
    return null;
  }
  return data.signedUrl;
}

/** Best-effort Storage cleanup when student_work rows are deleted. */
export async function deleteStoredStudentWorkFiles(
  storagePaths: Array<string | null>,
): Promise<void> {
  await removeStoredStudentWork(
    storagePaths.filter((p): p is string => Boolean(p)),
  );
}

export async function getStudentWorkForTeacher(input: {
  teacherId: string;
  documentId: string;
}): Promise<DocumentRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("id", input.documentId)
    .eq("kind", "student_work")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load homework document: ${error.message}`);
  }

  return (data as DocumentRow | null) ?? null;
}

export async function updateStudentWorkBodyText(input: {
  teacherId: string;
  documentId: string;
  bodyText: string;
}): Promise<DocumentRow> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("documents")
    .update({
      body_text: input.bodyText,
      updated_at: now,
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.documentId)
    .eq("kind", "student_work")
    .select(DOCUMENT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update homework text: ${error.message}`);
  }
  if (!data) {
    throw new Error("Homework document not found");
  }

  return data as DocumentRow;
}

export async function assignStudentToStudentWork(input: {
  teacherId: string;
  documentId: string;
  studentId: string;
}): Promise<DocumentRow> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("documents")
    .update({
      student_id: input.studentId,
      updated_at: now,
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.documentId)
    .eq("kind", "student_work")
    .select(DOCUMENT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to assign student: ${error.message}`);
  }
  if (!data) {
    throw new Error("Homework document not found");
  }

  return data as DocumentRow;
}
