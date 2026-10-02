"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString } from "@/lib/actionHelpers";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import { getAssignmentForTeacher } from "@/lib/grading/assignments";
import {
  combineUnfiledPages,
  CombinePagesError,
  loadAssignmentBatch,
} from "@/lib/grading/batch";
import { fileBatchWork } from "@/lib/grading/fileHomework";
import {
  gradingErrorRedirect,
  type GradingErrorCode,
} from "@/lib/grading/errors";
import {
  decideVisionApproval,
  gradeSuggestion,
  listGradingQueueForAssignment,
  requeueFailedGrading,
  type GradeOutcome,
} from "@/lib/grading/gradeWork";
import {
  createStudentWorkUploadTarget,
  deleteUnfiledStudentWork,
  EmptyHomeworkTextError,
  finalizeStudentWorkUpload,
  HomeworkTooLargeError,
  MAX_HOMEWORK_BYTES,
  UnsupportedHomeworkFormatError,
} from "@/lib/grading/upload";
import { MAX_BATCH_FILES } from "@/lib/grading/studentWorkFiles";

type Failure = { ok: false; code: GradingErrorCode };
export type BatchUploadTarget =
  | { ok: true; storagePath: string; token: string }
  | Failure;

function uploadErrorCode(error: unknown): GradingErrorCode {
  if (error instanceof UnsupportedHomeworkFormatError) return "invalid_format";
  if (error instanceof EmptyHomeworkTextError) return "empty_text";
  if (error instanceof HomeworkTooLargeError) return "file_too_large";
  return "upload_failed";
}

function fileErrorCode(error: unknown): GradingErrorCode {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Student not found")) return "student_not_found";
  if (message.includes("rubric")) return "rubric_missing";
  if (message.includes("document not found")) return "document_not_found";
  return "save_failed";
}

function revalidateAssignment(assignmentId: string, periodIds: string[] = []) {
  revalidatePath("/grading");
  revalidatePath(`/grading/assignments/${assignmentId}`);
  for (const periodId of new Set(periodIds)) {
    revalidatePath(`/grading/${periodId}`, "layout");
  }
}

/** Sign one upload URL per file for the whole batch in a single round trip. */
export async function requestBatchUploadAction(input: {
  assignmentId: string;
  files: Array<{ filename: string; size: number }>;
}): Promise<{ ok: true; targets: BatchUploadTarget[] } | Failure> {
  const teacher = await getCurrentTeacher();
  const files = Array.isArray(input?.files) ? input.files : [];
  if (files.length === 0) return { ok: false, code: "missing_file" };
  if (files.length > MAX_BATCH_FILES) {
    return { ok: false, code: "batch_too_large" };
  }

  const assignment = await getAssignmentForTeacher({
    teacherId: teacher.id,
    assignmentId: String(input?.assignmentId ?? ""),
  });
  if (!assignment) return { ok: false, code: "assignment_not_found" };

  const targets = await Promise.all(
    files.map(async (file): Promise<BatchUploadTarget> => {
      const filename = typeof file?.filename === "string" ? file.filename : "";
      const size = typeof file?.size === "number" ? file.size : 0;
      if (!filename || size <= 0) return { ok: false, code: "missing_file" };
      if (size > MAX_HOMEWORK_BYTES) {
        return { ok: false, code: "file_too_large" };
      }
      try {
        const target = await createStudentWorkUploadTarget({
          teacherId: teacher.id,
          filename,
          size,
        });
        return { ok: true, ...target };
      } catch (error) {
        console.error("requestBatchUploadAction failed", error);
        return { ok: false, code: uploadErrorCode(error) };
      }
    }),
  );

  return { ok: true, targets };
}

/** Turn one uploaded file into an unfiled student_work row under the assignment. */
export async function finalizeBatchUploadAction(input: {
  assignmentId: string;
  storagePath: string;
  filename: string;
}): Promise<{ ok: true } | Failure> {
  const teacher = await getCurrentTeacher();
  const storagePath =
    typeof input?.storagePath === "string" ? input.storagePath : "";
  if (!storagePath) return { ok: false, code: "missing_file" };

  const assignment = await getAssignmentForTeacher({
    teacherId: teacher.id,
    assignmentId: String(input?.assignmentId ?? ""),
  });
  if (!assignment) return { ok: false, code: "assignment_not_found" };

  try {
    await finalizeStudentWorkUpload({
      teacherId: teacher.id,
      assignmentId: assignment.id,
      storagePath,
      filename:
        typeof input?.filename === "string" && input.filename
          ? input.filename
          : "homework",
    });
  } catch (error) {
    console.error("finalizeBatchUploadAction failed", error);
    return { ok: false, code: uploadErrorCode(error) };
  }
  return { ok: true };
}

/**
 * File the checked Ready papers. Sorting is recomputed here, so only papers
 * that are still Ready get filed — the browser only picks which ones.
 */
export async function confirmReadyWorkAction(input: {
  assignmentId: string;
  documentIds: string[];
}): Promise<{ ok: true; filed: number; failed: number } | Failure> {
  const teacher = await getCurrentTeacher();
  const assignment = await getAssignmentForTeacher({
    teacherId: teacher.id,
    assignmentId: String(input?.assignmentId ?? ""),
  });
  if (!assignment) return { ok: false, code: "assignment_not_found" };

  const requested = new Set(
    Array.isArray(input?.documentIds) ? input.documentIds : [],
  );
  const { sorted } = await loadAssignmentBatch({
    teacherId: teacher.id,
    assignment,
  });

  let filed = 0;
  let failed = 0;
  const periodIds: string[] = [];
  for (const item of sorted) {
    if (item.status !== "ready" || !requested.has(item.document.id)) continue;
    try {
      const session = await fileBatchWork({
        teacherId: teacher.id,
        assignment,
        documentId: item.document.id,
        studentId: item.student.studentId,
      });
      periodIds.push(session.section_id);
      filed += 1;
    } catch (error) {
      console.error("confirmReadyWorkAction item failed", error);
      failed += 1;
    }
  }

  revalidateAssignment(assignment.id, periodIds);
  return { ok: true, filed, failed };
}

/** File one Unsorted paper with the student the teacher picked. */
export async function fileUnsortedWorkAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const assignmentId = formString(formData, "assignmentId");
  const documentId = formString(formData, "documentId");
  const studentId = formString(formData, "studentId");
  const assignmentPath = `/grading/assignments/${assignmentId}`;

  const assignment = await getAssignmentForTeacher({
    teacherId: teacher.id,
    assignmentId,
  });
  if (!assignment) {
    redirect(gradingErrorRedirect("/grading", "assignment_not_found"));
  }
  if (!studentId) {
    redirect(gradingErrorRedirect(assignmentPath, "student_required"));
  }

  let periodId: string;
  try {
    const session = await fileBatchWork({
      teacherId: teacher.id,
      assignment,
      documentId,
      studentId,
    });
    periodId = session.section_id;
  } catch (error) {
    console.error("fileUnsortedWorkAction failed", error);
    redirect(gradingErrorRedirect(assignmentPath, fileErrorCode(error)));
  }

  revalidateAssignment(assignment.id, [periodId]);
  redirect(assignmentPath);
}

/** Grade one filed paper (the browser runs these a few at a time after filing). */
export async function gradeSuggestionAction(input: {
  suggestionId: string;
}): Promise<{ ok: true; outcome: GradeOutcome } | Failure> {
  const teacher = await getCurrentTeacher();
  const suggestionId = String(input?.suggestionId ?? "");
  if (!suggestionId) return { ok: false, code: "document_not_found" };
  try {
    const outcome = await gradeSuggestion({ teacherId: teacher.id, suggestionId });
    return { ok: true, outcome };
  } catch (error) {
    console.error("gradeSuggestionAction failed", error);
    return { ok: false, code: "grading_failed" };
  }
}

export async function retryFailedGradingAction(input: {
  assignmentId: string;
}): Promise<{ ok: true } | Failure> {
  const teacher = await getCurrentTeacher();
  const assignmentId = String(input?.assignmentId ?? "");
  try {
    const { failedIds } = await listGradingQueueForAssignment({
      teacherId: teacher.id,
      assignmentId,
    });
    await requeueFailedGrading({ teacherId: teacher.id, suggestionIds: failedIds });
  } catch (error) {
    console.error("retryFailedGradingAction failed", error);
    return { ok: false, code: "grading_failed" };
  }
  revalidatePath(`/grading/assignments/${assignmentId}`);
  return { ok: true };
}

/** Teacher checked the masked preview of a photo: grade it, or keep it off the AI. */
export async function decideVisionApprovalAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const suggestionId = formString(formData, "suggestionId");
  const periodId = formString(formData, "periodId");
  const sessionId = formString(formData, "sessionId");
  const sessionPath = `/grading/${periodId}/${sessionId}`;

  let saved = false;
  try {
    saved = await decideVisionApproval({
      teacherId: teacher.id,
      suggestionId,
      approve: formString(formData, "decision") === "approve",
    });
  } catch (error) {
    console.error("decideVisionApprovalAction failed", error);
  }
  if (!saved) {
    redirect(gradingErrorRedirect(sessionPath, "approval_failed"));
  }

  revalidatePath(sessionPath);
  redirect(sessionPath);
}

/** Merge the checked Unsorted photos into one multi-page paper. */
export async function combineUnfiledPagesAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const assignmentId = formString(formData, "assignmentId");
  const assignmentPath = `/grading/assignments/${assignmentId}`;

  try {
    await combineUnfiledPages({
      teacherId: teacher.id,
      assignmentId,
      documentIds: formData
        .getAll("combineIds")
        .filter((id): id is string => typeof id === "string"),
    });
  } catch (error) {
    console.error("combineUnfiledPagesAction failed", error);
    redirect(
      gradingErrorRedirect(
        assignmentPath,
        error instanceof CombinePagesError ? error.code : "combine_failed",
      ),
    );
  }

  revalidatePath(assignmentPath);
  redirect(assignmentPath);
}

/** Drop an unfiled upload (wrong file, duplicate, etc.). */
export async function removeUnfiledWorkAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const assignmentId = formString(formData, "assignmentId");
  const documentId = formString(formData, "documentId");
  const assignmentPath = `/grading/assignments/${assignmentId}`;

  try {
    await deleteUnfiledStudentWork({ teacherId: teacher.id, documentId });
  } catch (error) {
    console.error("removeUnfiledWorkAction failed", error);
    redirect(gradingErrorRedirect(assignmentPath, "delete_failed"));
  }

  revalidatePath(assignmentPath);
  redirect(assignmentPath);
}
