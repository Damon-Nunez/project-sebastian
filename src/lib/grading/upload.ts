import type { DocumentRow } from "@/lib/db/types";
import {
  EmptyFrameworkTextError,
  extractFrameworkText,
  UnsupportedFrameworkFormatError,
} from "@/lib/lessons/extract";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const DOCUMENT_SELECT =
  "id, teacher_id, kind, original_filename, storage_path, lesson_plan_id, grading_session_id, student_id, body_text, created_at, updated_at";

export const MAX_HOMEWORK_BYTES = 20 * 1024 * 1024;

export {
  EmptyFrameworkTextError as EmptyHomeworkTextError,
  UnsupportedFrameworkFormatError as UnsupportedHomeworkFormatError,
};

export type HomeworkUploadResult = {
  document: DocumentRow;
};

/**
 * Extract plain text from a homework upload and store a student_work document.
 * grading_session_id stays null until the teacher saves into an assignment folder.
 */
export async function createStudentWorkFromUpload(input: {
  teacherId: string;
  filename: string;
  bytes: Buffer;
}): Promise<HomeworkUploadResult> {
  if (input.bytes.byteLength === 0) {
    throw new Error("Homework file is empty");
  }
  if (input.bytes.byteLength > MAX_HOMEWORK_BYTES) {
    throw new Error("Homework file is too large");
  }

  const extracted = await extractFrameworkText({
    buffer: input.bytes,
    filename: input.filename,
  });

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("documents")
    .insert({
      teacher_id: input.teacherId,
      kind: "student_work",
      original_filename: input.filename,
      storage_path: null,
      lesson_plan_id: null,
      grading_session_id: null,
      student_id: null,
      body_text: extracted.text,
      updated_at: now,
    })
    .select(DOCUMENT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save homework document: ${error?.message ?? "unknown error"}`,
    );
  }

  return { document: data as DocumentRow };
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
