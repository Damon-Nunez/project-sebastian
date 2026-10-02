"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString } from "@/lib/actionHelpers";
import { getCurrentTeacher } from "@/lib/auth/getCurrentTeacher";
import type { AssignmentType } from "@/lib/db/types";
import {
  findOrCreateAssignment,
  getAssignmentForTeacher,
  setAssignmentReference,
} from "@/lib/grading/assignments";
import { deleteAssignmentForTeacher } from "@/lib/grading/deleteAssignment";
import {
  gradingErrorRedirect,
  type GradingErrorCode,
} from "@/lib/grading/errors";
import {
  hasAssignmentFolderPath,
  normalizeAssignmentFolderLabels,
  normalizeFolderLabel,
} from "@/lib/grading/labels";
import {
  parseReferenceKind,
  validateReferenceText,
} from "@/lib/grading/reference";
import {
  EmptyHomeworkTextError,
  extractStoredDocumentText,
  UnsupportedHomeworkFormatError,
} from "@/lib/grading/upload";
import { getUnitForTeacher } from "@/lib/units/units";

const ASSIGNMENT_TYPES = new Set<AssignmentType>([
  "hw",
  "short_response",
  "essay",
]);

export async function createAssignmentAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const newPath = "/grading/assignments/new";
  const rawType = formString(formData, "assignmentType");
  const assignmentType = ASSIGNMENT_TYPES.has(rawType as AssignmentType)
    ? (rawType as AssignmentType)
    : "hw";
  const labels = normalizeAssignmentFolderLabels({
    moduleLabel: formString(formData, "moduleLabel"),
    unitLabel: formString(formData, "unitLabel"),
    lessonLabel: formString(formData, "lessonLabel"),
  });
  const title = normalizeFolderLabel(formString(formData, "title"));

  if (!hasAssignmentFolderPath(labels)) {
    redirect(gradingErrorRedirect(newPath, "assignment_path_required"));
  }

  let unitId: string | null = null;
  if (assignmentType === "essay") {
    const rawUnitId = formString(formData, "unitId");
    const unit = rawUnitId
      ? await getUnitForTeacher(teacher.id, rawUnitId)
      : null;
    if (!unit) redirect(gradingErrorRedirect(newPath, "unit_required"));
    unitId = unit.id;
  }

  let assignmentId: string;
  try {
    const { assignment } = await findOrCreateAssignment({
      teacherId: teacher.id,
      assignmentType,
      labels,
      unitId,
      title,
    });
    assignmentId = assignment.id;
  } catch (error) {
    console.error("createAssignmentAction failed", error);
    redirect(gradingErrorRedirect(newPath, "create_failed"));
  }

  revalidatePath("/grading");
  redirect(`/grading/assignments/${assignmentId}`);
}

/** Delete the teacher-level assignment and every period folder under it. */
export async function deleteAssignmentAction(formData: FormData) {
  const teacher = await getCurrentTeacher();
  const assignmentId = formString(formData, "assignmentId");
  const fallback = assignmentId
    ? `/grading/assignments/${assignmentId}`
    : "/grading";

  if (!assignmentId) {
    redirect(gradingErrorRedirect("/grading", "assignment_not_found"));
  }

  try {
    await deleteAssignmentForTeacher({
      teacherId: teacher.id,
      assignmentId,
    });
  } catch (error) {
    console.error("deleteAssignmentAction failed", error);
    redirect(gradingErrorRedirect(fallback, "delete_failed"));
  }

  revalidatePath("/grading");
  redirect("/grading");
}

/**
 * Save the assignment reference. Either a file already uploaded to Storage
 * (text is extracted server-side) or pasted/edited text. "none" clears it.
 */
export async function saveAssignmentReferenceAction(input: {
  assignmentId: string;
  kind: string;
  text?: string;
  storagePath?: string;
  filename?: string;
}): Promise<{ ok: true } | { ok: false; code: GradingErrorCode }> {
  const teacher = await getCurrentTeacher();
  const assignmentId =
    typeof input?.assignmentId === "string" ? input.assignmentId : "";
  const kind = parseReferenceKind(input?.kind);
  const storagePath =
    typeof input?.storagePath === "string" ? input.storagePath : "";
  const filename =
    typeof input?.filename === "string" && input.filename
      ? input.filename
      : "reference";

  if (!assignmentId || !kind) return { ok: false, code: "reference_failed" };

  const assignment = await getAssignmentForTeacher({
    teacherId: teacher.id,
    assignmentId,
  });
  if (!assignment) return { ok: false, code: "assignment_not_found" };

  let rawText = typeof input?.text === "string" ? input.text : "";
  if (kind !== "none" && storagePath) {
    try {
      rawText = await extractStoredDocumentText({
        teacherId: teacher.id,
        storagePath,
        filename,
      });
    } catch (error) {
      if (error instanceof UnsupportedHomeworkFormatError) {
        return { ok: false, code: "reference_file_invalid" };
      }
      if (error instanceof EmptyHomeworkTextError) {
        return { ok: false, code: "reference_file_empty" };
      }
      console.error("saveAssignmentReferenceAction extract failed", error);
      return { ok: false, code: "reference_failed" };
    }
  }

  const validated = validateReferenceText(kind, rawText);
  if (!validated.ok) return { ok: false, code: validated.code };

  try {
    await setAssignmentReference({
      teacherId: teacher.id,
      assignmentId,
      kind,
      text: validated.text,
      storagePath: kind !== "none" && storagePath ? storagePath : null,
      filename: storagePath ? filename : null,
    });
  } catch (error) {
    console.error("saveAssignmentReferenceAction failed", error);
    return { ok: false, code: "reference_failed" };
  }

  revalidatePath(`/grading/assignments/${assignmentId}`);
  revalidatePath("/grading");
  return { ok: true };
}
