import type {
  AssignmentType,
  DocumentRow,
  GradingSessionRow,
  GradingSuggestionRow,
} from "@/lib/db/types";
import {
  findOrCreateAssignmentFolder,
  getGradingSessionForTeacher,
} from "@/lib/grading/sessions";
import { getStudentWorkForTeacher } from "@/lib/grading/upload";
import { getStudentForTeacher } from "@/lib/roster/students";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const SUGGESTION_SELECT =
  "id, teacher_id, grading_session_id, student_id, document_id, suggested_range_low, suggested_range_high, suggested_comment, accommodation_flagged, teacher_grade, teacher_comment, status, created_at, updated_at";

const DOCUMENT_SELECT =
  "id, teacher_id, kind, original_filename, storage_path, lesson_plan_id, grading_session_id, student_id, body_text, created_at, updated_at";

export type FileHomeworkResult = {
  session: GradingSessionRow;
  document: DocumentRow;
  suggestion: GradingSuggestionRow;
};

export async function fileStudentWorkIntoAssignmentFolder(input: {
  teacherId: string;
  documentId: string;
  bodyText?: string | null;
  assignmentType: AssignmentType;
  moduleLabel?: string | null;
  unitLabel?: string | null;
  lessonLabel?: string | null;
  title?: string | null;
  unitId?: string | null;
}): Promise<FileHomeworkResult> {
  const document = await getStudentWorkForTeacher({
    teacherId: input.teacherId,
    documentId: input.documentId,
  });
  if (!document) {
    throw new Error("Homework document not found");
  }
  if (!document.student_id) {
    throw new Error("Assign a student before saving into a folder.");
  }

  const student = await getStudentForTeacher(
    input.teacherId,
    document.student_id,
  );
  if (!student) {
    throw new Error("Student not found");
  }

  const { session } = await findOrCreateAssignmentFolder({
    teacherId: input.teacherId,
    sectionId: student.section_id,
    assignmentType: input.assignmentType,
    moduleLabel: input.moduleLabel,
    unitLabel: input.unitLabel,
    lessonLabel: input.lessonLabel,
    title: input.title,
    unitId: input.unitId,
  });

  const linked = await linkStudentWorkToSession({
    teacherId: input.teacherId,
    documentId: input.documentId,
    sessionId: session.id,
  });

  const suggestion = await upsertDraftSuggestion({
    teacherId: input.teacherId,
    sessionId: session.id,
    studentId: student.id,
    documentId: input.documentId,
  });

  return {
    session,
    document: linked,
    suggestion,
  };
}

async function linkStudentWorkToSession(input: {
  teacherId: string;
  documentId: string;
  sessionId: string;
}): Promise<DocumentRow> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("documents")
    .update({
      grading_session_id: input.sessionId,
      updated_at: now,
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.documentId)
    .eq("kind", "student_work")
    .select(DOCUMENT_SELECT)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to file homework into folder: ${error.message}`);
  }
  if (!data) {
    throw new Error("Homework document not found");
  }
  return data as DocumentRow;
}

async function upsertDraftSuggestion(input: {
  teacherId: string;
  sessionId: string;
  studentId: string;
  documentId: string;
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

/**
 * After a student change on already-filed work, move the document and
 * draft suggestion into the matching folder for that student's period.
 */
export async function refileFiledHomeworkToStudent(input: {
  teacherId: string;
  documentId: string;
}): Promise<{
  document: DocumentRow;
  previousSessionId: string | null;
  previousPeriodId: string | null;
  session: GradingSessionRow | null;
}> {
  const document = await getStudentWorkForTeacher({
    teacherId: input.teacherId,
    documentId: input.documentId,
  });
  if (!document) {
    throw new Error("Homework document not found");
  }
  if (!document.student_id || !document.grading_session_id) {
    return {
      document,
      previousSessionId: document.grading_session_id,
      previousPeriodId: null,
      session: null,
    };
  }

  const [student, previous] = await Promise.all([
    getStudentForTeacher(input.teacherId, document.student_id),
    getGradingSessionForTeacher({
      teacherId: input.teacherId,
      sessionId: document.grading_session_id,
    }),
  ]);
  if (!student) {
    throw new Error("Student not found");
  }
  if (!previous) {
    return {
      document,
      previousSessionId: document.grading_session_id,
      previousPeriodId: null,
      session: null,
    };
  }

  const { session } = await findOrCreateAssignmentFolder({
    teacherId: input.teacherId,
    sectionId: student.section_id,
    assignmentType: previous.assignment_type,
    moduleLabel: previous.module_label,
    unitLabel: previous.unit_label,
    lessonLabel: previous.lesson_label,
    title: previous.title,
  });

  const linked = await linkStudentWorkToSession({
    teacherId: input.teacherId,
    documentId: input.documentId,
    sessionId: session.id,
  });

  await upsertDraftSuggestion({
    teacherId: input.teacherId,
    sessionId: session.id,
    studentId: student.id,
    documentId: input.documentId,
  });

  return {
    document: linked,
    previousSessionId: previous.id,
    previousPeriodId: previous.section_id,
    session,
  };
}

export async function listStudentWorkForSession(input: {
  teacherId: string;
  sessionId: string;
}): Promise<DocumentRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("grading_session_id", input.sessionId)
    .eq("kind", "student_work")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list homework in folder: ${error.message}`);
  }

  return (data ?? []) as DocumentRow[];
}
