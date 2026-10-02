/**
 * Teacher-level assignment delete (joined with period folders).
 * Kept separate so assignments ↔ sessions don't import each other.
 */
import {
  getAssignmentForTeacher,
  listPeriodFoldersForAssignment,
} from "@/lib/grading/assignments";
import { deleteGradingSessionForTeacher } from "@/lib/grading/sessions";
import {
  deleteStoredStudentWorkFiles,
  listUnfiledStudentWorkForAssignment,
} from "@/lib/grading/upload";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Delete a teacher-level assignment and everything under it: unfiled uploads,
 * every period folder (and its papers), and the answer-key file in Storage.
 */
export async function deleteAssignmentForTeacher(input: {
  teacherId: string;
  assignmentId: string;
}): Promise<void> {
  const existing = await getAssignmentForTeacher(input);
  if (!existing) {
    throw new Error("Assignment not found");
  }

  const folders = await listPeriodFoldersForAssignment(input);
  for (const folder of folders) {
    await deleteGradingSessionForTeacher({
      teacherId: input.teacherId,
      sessionId: folder.session.id,
    });
  }

  const unfiled = await listUnfiledStudentWorkForAssignment(input);
  await deleteStoredStudentWorkFiles(unfiled);

  const admin = createAdminSupabaseClient();
  if (unfiled.length > 0) {
    const { error: unfiledError } = await admin
      .from("documents")
      .delete()
      .eq("teacher_id", input.teacherId)
      .eq("assignment_id", input.assignmentId)
      .eq("kind", "student_work")
      .is("grading_session_id", null);
    if (unfiledError) {
      throw new Error(`Failed to delete unfiled homework: ${unfiledError.message}`);
    }
  }

  const { error } = await admin
    .from("assignments")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("id", input.assignmentId);
  if (error) {
    throw new Error(`Failed to delete assignment: ${error.message}`);
  }

  if (existing.reference_storage_path) {
    await deleteStoredStudentWorkFiles([
      { storage_path: existing.reference_storage_path },
    ]);
  }
}
