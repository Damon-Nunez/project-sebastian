import {
  DOCUMENT_SELECT,
  type AiGradingStatus,
  type AssignmentRow,
  type DocumentRow,
  type GradingSessionRow,
  type GradingSuggestionRow,
} from "@/lib/db/types";
import { findOrCreateAssignmentFolder } from "@/lib/grading/sessions";
import { parseVisionPages } from "@/lib/grading/studentWorkFiles";
import { getStudentWorkForTeacher } from "@/lib/grading/upload";
import { getStudentForTeacher } from "@/lib/roster/students";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const SUGGESTION_SELECT =
  "id, teacher_id, grading_session_id, student_id, document_id, suggested_range_low, suggested_range_high, suggested_comment, accommodation_flagged, teacher_grade, teacher_comment, status, ai_status, grading_detail, graded_reference_at, created_at, updated_at";

/** Photos wait for the teacher to approve the masked preview before any AI call. */
export function initialAiStatus(
  document: Pick<DocumentRow, "needs_vision" | "vision_pages">,
): AiGradingStatus {
  if (!document.needs_vision) return "pending";
  return parseVisionPages(document.vision_pages).length > 0
    ? "awaiting_approval"
    : "needs_vision";
}

/**
 * File an unfiled upload into the student's period folder for this
 * assignment (folder found or created on the teacher's confirm click).
 * The document update only matches while it is still unfiled, so a double
 * click can't file it twice.
 */
export async function fileBatchWork(input: {
  teacherId: string;
  assignment: AssignmentRow;
  documentId: string;
  studentId: string;
}): Promise<GradingSessionRow> {
  const [document, student] = await Promise.all([
    getStudentWorkForTeacher({
      teacherId: input.teacherId,
      documentId: input.documentId,
    }),
    getStudentForTeacher(input.teacherId, input.studentId),
  ]);
  if (!student) {
    throw new Error("Student not found");
  }
  if (
    !document ||
    document.assignment_id !== input.assignment.id ||
    document.grading_session_id !== null
  ) {
    throw new Error("Homework document not found");
  }

  const { session } = await findOrCreateAssignmentFolder({
    teacherId: input.teacherId,
    sectionId: student.section_id,
    assignmentType: input.assignment.assignment_type,
    moduleLabel: input.assignment.module_label,
    unitLabel: input.assignment.unit_label,
    lessonLabel: input.assignment.lesson_label,
    unitId: input.assignment.unit_id,
    title: input.assignment.title,
  });

  const { data: filed, error } = await createAdminSupabaseClient()
    .from("documents")
    .update({
      student_id: student.id,
      grading_session_id: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", document.id)
    .eq("kind", "student_work")
    .is("grading_session_id", null)
    .select(DOCUMENT_SELECT)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to file homework into folder: ${error.message}`);
  }
  if (!filed) {
    throw new Error("Homework document not found");
  }

  await upsertDraftSuggestion({
    teacherId: input.teacherId,
    sessionId: session.id,
    studentId: student.id,
    documentId: document.id,
    aiStatus: initialAiStatus(filed as DocumentRow),
  });
  return session;
}

async function upsertDraftSuggestion(input: {
  teacherId: string;
  sessionId: string;
  studentId: string;
  documentId: string;
  aiStatus: AiGradingStatus;
}): Promise<GradingSuggestionRow> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: existing, error: findError } = await admin
    .from("grading_suggestions")
    .select(SUGGESTION_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("document_id", input.documentId)
    .maybeSingle();

  if (findError) {
    throw new Error(`Failed to load grading draft: ${findError.message}`);
  }

  if (existing) {
    const { data, error } = await admin
      .from("grading_suggestions")
      .update({
        grading_session_id: input.sessionId,
        student_id: input.studentId,
        document_id: input.documentId,
        ai_status: input.aiStatus,
        updated_at: now,
      })
      .eq("teacher_id", input.teacherId)
      .eq("id", (existing as GradingSuggestionRow).id)
      .select(SUGGESTION_SELECT)
      .single();

    if (error || !data) {
      throw new Error(
        `Failed to update grading draft: ${error?.message ?? "unknown error"}`,
      );
    }
    return data as GradingSuggestionRow;
  }

  const { data, error } = await admin
    .from("grading_suggestions")
    .insert({
      teacher_id: input.teacherId,
      grading_session_id: input.sessionId,
      student_id: input.studentId,
      document_id: input.documentId,
      status: "draft",
      ai_status: input.aiStatus,
      updated_at: now,
    })
    .select(SUGGESTION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create grading draft: ${error?.message ?? "unknown error"}`,
    );
  }
  return data as GradingSuggestionRow;
}
