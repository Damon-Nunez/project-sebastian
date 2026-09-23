"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString } from "@/lib/actionHelpers";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import type { AssignmentType } from "@/lib/db/types";
import {
  gradingErrorRedirect,
  type GradingErrorCode,
} from "@/lib/grading/errors";
import {
  fileStudentWorkIntoAssignmentFolder,
  refileFiledHomeworkToStudent,
} from "@/lib/grading/fileHomework";
import {
  deleteGradingSessionForTeacher,
  findOrCreateAssignmentFolder,
} from "@/lib/grading/sessions";
import { headerTextForMatch } from "@/lib/grading/headerText";
import { matchHomeworkToRoster } from "@/lib/grading/matchHomework";
import {
  assignStudentToStudentWork,
  createStudentWorkFromUpload,
  EmptyHomeworkTextError,
  getStudentWorkForTeacher,
  MAX_HOMEWORK_BYTES,
  UnsupportedHomeworkFormatError,
} from "@/lib/grading/upload";
import {
  getPeriodForTeacher,
  listPeriodsWithRostersForTeacher,
} from "@/lib/roster/periods";
import { getStudentForTeacher } from "@/lib/roster/students";

const ASSIGNMENT_TYPES = new Set<AssignmentType>([
  "hw",
  "short_response",
  "essay",
]);

function parseAssignmentType(raw: string): AssignmentType {
  if (ASSIGNMENT_TYPES.has(raw as AssignmentType)) {
    return raw as AssignmentType;
  }
  return "hw";
}

export async function uploadHomeworkAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    redirect(gradingErrorRedirect("/grading", "missing_file"));
  }

  if (file.size > MAX_HOMEWORK_BYTES) {
    redirect(gradingErrorRedirect("/grading", "file_too_large"));
  }

  const filename = file.name || "homework.bin";
  const bytes = Buffer.from(await file.arrayBuffer());

  let documentId: string;
  try {
    const { document } = await createStudentWorkFromUpload({
      teacherId: teacher.id,
      filename,
      bytes,
    });
    documentId = document.id;

    const periods = await listPeriodsWithRostersForTeacher(teacher.id);
    const match = matchHomeworkToRoster(periods, {
      filename: document.original_filename,
      headerText: headerTextForMatch(document.body_text ?? ""),
    });
    if (match.status === "matched") {
      await assignStudentToStudentWork({
        teacherId: teacher.id,
        documentId,
        studentId: match.student.studentId,
      });
    }
  } catch (error) {
    if (error instanceof UnsupportedHomeworkFormatError) {
      redirect(gradingErrorRedirect("/grading", "invalid_format"));
    }
    if (error instanceof EmptyHomeworkTextError) {
      redirect(gradingErrorRedirect("/grading", "empty_text"));
    }
    console.error("uploadHomeworkAction failed", error);
    redirect(gradingErrorRedirect("/grading", "upload_failed"));
  }

  revalidatePath("/grading");
  redirect(`/grading/work/${documentId}`);
}

export async function assignHomeworkStudentAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const documentId = formString(formData, "documentId");
  const studentId = formString(formData, "studentId");

  if (!documentId) {
    redirect(gradingErrorRedirect("/grading", "document_not_found"));
  }

  const workPath = `/grading/work/${documentId}`;

  if (!studentId) {
    redirect(gradingErrorRedirect(workPath, "student_required"));
  }

  const [document, student] = await Promise.all([
    getStudentWorkForTeacher({ teacherId: teacher.id, documentId }),
    getStudentForTeacher(teacher.id, studentId),
  ]);

  if (!document) {
    redirect(gradingErrorRedirect("/grading", "document_not_found"));
  }
  if (!student) {
    redirect(gradingErrorRedirect(workPath, "student_not_found"));
  }

  let previousPeriodId: string | null = null;
  let previousSessionId: string | null = null;
  let newPeriodId: string | null = null;
  let newSessionId: string | null = null;
  try {
    await assignStudentToStudentWork({
      teacherId: teacher.id,
      documentId,
      studentId,
    });
    const refiled = await refileFiledHomeworkToStudent({
      teacherId: teacher.id,
      documentId,
    });
    previousPeriodId = refiled.previousPeriodId;
    previousSessionId = refiled.previousSessionId;
    newPeriodId = refiled.session?.section_id ?? null;
    newSessionId = refiled.session?.id ?? null;
  } catch (error) {
    console.error("assignHomeworkStudentAction failed", error);
    redirect(gradingErrorRedirect(workPath, "assign_failed"));
  }

  revalidatePath("/grading");
  revalidatePath(workPath);
  if (previousPeriodId) {
    revalidatePath(`/grading/${previousPeriodId}`);
    if (previousSessionId) {
      revalidatePath(`/grading/${previousPeriodId}/${previousSessionId}`);
    }
  }
  if (newPeriodId) {
    revalidatePath(`/grading/${newPeriodId}`);
    if (newSessionId) {
      revalidatePath(`/grading/${newPeriodId}/${newSessionId}`);
    }
  }
  redirect(workPath);
}

export async function saveHomeworkDraftAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const documentId = formString(formData, "documentId");
  const workPath = documentId
    ? `/grading/work/${documentId}`
    : "/grading";

  if (!documentId) {
    redirect(gradingErrorRedirect("/grading", "document_not_found"));
  }

  const assignmentType = parseAssignmentType(
    formString(formData, "assignmentType"),
  );

  let periodId: string;
  let sessionId: string;
  try {
    const { session } = await fileStudentWorkIntoAssignmentFolder({
      teacherId: teacher.id,
      documentId,
      assignmentType,
      moduleLabel: formString(formData, "moduleLabel"),
      unitLabel: formString(formData, "unitLabel"),
      lessonLabel: formString(formData, "lessonLabel"),
      title: formString(formData, "title"),
      unitId: formString(formData, "unitId") || null,
    });
    periodId = session.section_id;
    sessionId = session.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    let code: GradingErrorCode = "save_failed";
    if (message.includes("Assign a student")) code = "student_required";
    if (message.includes("Student not found")) code = "student_not_found";
    if (message.includes("folder path")) code = "folder_path_required";
    if (message.includes("rubric")) code = "rubric_missing";
    if (message.includes("document not found")) code = "document_not_found";
    console.error("saveHomeworkDraftAction failed", error);
    redirect(gradingErrorRedirect(workPath, code));
  }

  revalidatePath("/grading");
  revalidatePath(`/grading/${periodId}`);
  revalidatePath(`/grading/${periodId}/${sessionId}`);
  revalidatePath(workPath);
  redirect(`/grading/${periodId}/${sessionId}`);
}

export async function createAssignmentFolderAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const periodId = formString(formData, "periodId");
  const assignmentType = parseAssignmentType(
    formString(formData, "assignmentType"),
  );

  const period = await getPeriodForTeacher(teacher.id, periodId);
  if (!period) {
    redirect(gradingErrorRedirect("/grading", "period_not_found"));
  }

  let sessionId: string;
  try {
    const { session } = await findOrCreateAssignmentFolder({
      teacherId: teacher.id,
      sectionId: periodId,
      assignmentType,
      moduleLabel: formString(formData, "moduleLabel"),
      unitLabel: formString(formData, "unitLabel"),
      lessonLabel: formString(formData, "lessonLabel"),
      title: formString(formData, "title"),
      unitId: formString(formData, "unitId") || null,
    });
    sessionId = session.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    let code: GradingErrorCode = "create_failed";
    if (message.includes("folder path")) code = "folder_path_required";
    if (message.includes("rubric")) code = "rubric_missing";
    console.error("createAssignmentFolderAction failed", error);
    redirect(gradingErrorRedirect(`/grading/${periodId}`, code));
  }

  revalidatePath("/grading");
  revalidatePath(`/grading/${periodId}`);
  redirect(`/grading/${periodId}/${sessionId}`);
}

export async function deleteAssignmentFolderAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const sessionId = formString(formData, "sessionId");
  const periodId = formString(formData, "periodId");
  const fallback = periodId ? `/grading/${periodId}` : "/grading";

  if (!sessionId) {
    redirect(gradingErrorRedirect(fallback, "session_not_found"));
  }

  let deletedPeriodId: string;
  try {
    const deleted = await deleteGradingSessionForTeacher({
      teacherId: teacher.id,
      sessionId,
    });
    deletedPeriodId = deleted.periodId;
  } catch (error) {
    console.error("deleteAssignmentFolderAction failed", error);
    redirect(gradingErrorRedirect(fallback, "delete_failed"));
  }

  revalidatePath("/grading");
  revalidatePath(`/grading/${deletedPeriodId}`);
  redirect(`/grading/${deletedPeriodId}`);
}
