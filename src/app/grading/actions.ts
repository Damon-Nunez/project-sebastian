"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString } from "@/lib/actionHelpers";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import {
  gradingErrorRedirect,
  type GradingErrorCode,
} from "@/lib/grading/errors";
import { deleteGradingSessionForTeacher } from "@/lib/grading/sessions";
import {
  createStudentWorkUploadTarget,
  EmptyHomeworkTextError,
  HomeworkTooLargeError,
  MAX_HOMEWORK_BYTES,
  UnsupportedHomeworkFormatError,
} from "@/lib/grading/upload";

type HomeworkUploadFailure = { ok: false; code: GradingErrorCode };

function homeworkUploadErrorCode(error: unknown): GradingErrorCode {
  if (error instanceof UnsupportedHomeworkFormatError) return "invalid_format";
  if (error instanceof EmptyHomeworkTextError) return "empty_text";
  if (error instanceof HomeworkTooLargeError) return "file_too_large";
  return "upload_failed";
}

/** Sign a one-time Storage upload so file bytes skip the Vercel body limit. */
export async function requestHomeworkUploadAction(input: {
  filename: string;
  size: number;
}): Promise<
  { ok: true; storagePath: string; token: string } | HomeworkUploadFailure
> {
  const teacher = await getCurrentTeacher();
  const filename = typeof input?.filename === "string" ? input.filename : "";
  const size = typeof input?.size === "number" ? input.size : 0;

  if (!filename || size <= 0) return { ok: false, code: "missing_file" };
  if (size > MAX_HOMEWORK_BYTES) return { ok: false, code: "file_too_large" };

  try {
    const target = await createStudentWorkUploadTarget({
      teacherId: teacher.id,
      filename,
      size,
    });
    return { ok: true, ...target };
  } catch (error) {
    console.error("requestHomeworkUploadAction failed", error);
    return { ok: false, code: homeworkUploadErrorCode(error) };
  }
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
