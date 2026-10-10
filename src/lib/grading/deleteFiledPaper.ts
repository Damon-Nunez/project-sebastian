/**
 * Remove one filed paper from a class (faulty or unwanted submission).
 * Deletes the grade row, the document, and the stored files.
 */
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { deleteStoredStudentWorkFiles, getStudentWorkForTeacher } from "./upload";

export async function deleteFiledPaperForTeacher(input: {
  teacherId: string;
  suggestionId: string;
  sessionId: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { data: suggestion, error: loadError } = await admin
    .from("grading_suggestions")
    .select("id, document_id, grading_session_id")
    .eq("teacher_id", input.teacherId)
    .eq("id", input.suggestionId)
    .maybeSingle();

  if (loadError) {
    throw new Error(`Failed to load paper: ${loadError.message}`);
  }
  if (!suggestion || suggestion.grading_session_id !== input.sessionId) {
    throw new Error("Paper not found");
  }

  const document = suggestion.document_id
    ? await getStudentWorkForTeacher({
        teacherId: input.teacherId,
        documentId: suggestion.document_id,
      })
    : null;

  if (document && document.grading_session_id === input.sessionId) {
    const { error: documentError } = await admin
      .from("documents")
      .delete()
      .eq("teacher_id", input.teacherId)
      .eq("id", document.id)
      .eq("grading_session_id", input.sessionId);
    if (documentError) {
      throw new Error(`Failed to delete paper file: ${documentError.message}`);
    }
    await deleteStoredStudentWorkFiles([document]);
  }

  const { error: suggestionError } = await admin
    .from("grading_suggestions")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("id", input.suggestionId)
    .eq("grading_session_id", input.sessionId);

  if (suggestionError) {
    throw new Error(`Failed to delete paper: ${suggestionError.message}`);
  }
}
