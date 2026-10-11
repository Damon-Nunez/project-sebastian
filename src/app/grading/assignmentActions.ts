"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formString } from "@/lib/actionHelpers";
import { getCurrentTeacher } from "@/lib/auth/teacher";
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
  MAX_REFERENCE_PHOTO_PAGES,
  parseReferenceKind,
  validateReferenceText,
} from "@/lib/grading/reference";
import {
  EmptyHomeworkTextError,
  ingestAssignmentReferenceFiles,
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
 * Save the assignment reference. Files already in Storage are OCR'd / parsed
 * server-side (supports multi-page photo keys). "none" clears it.
 */
export async function saveAssignmentReferenceAction(input: {
  assignmentId: string;
  kind: string;
  text?: string;
  /** Single-file upload (still supported). */
  storagePath?: string;
  filename?: string;
  /** Multi-page photo (or mixed) answer key — preferred when dropping several files. */
  files?: Array<{ storagePath: string; filename: string }>;
}): Promise<
  | { ok: true; text: string | null; pageCount: number; source: "vision" | "extract" | "text" }
  | { ok: false; code: GradingErrorCode }
> {
  const teacher = await getCurrentTeacher();
  const assignmentId =
    typeof input?.assignmentId === "string" ? input.assignmentId : "";
  const kind = parseReferenceKind(input?.kind);

  const files = Array.isArray(input?.files)
    ? input.files.filter(
        (file) =>
          file &&
          typeof file.storagePath === "string" &&
          file.storagePath &&
          typeof file.filename === "string" &&
          file.filename,
      )
    : input?.storagePath
      ? [
          {
            storagePath: input.storagePath,
            filename:
              typeof input.filename === "string" && input.filename
                ? input.filename
                : "reference",
          },
        ]
      : [];

  if (!assignmentId || !kind) return { ok: false, code: "reference_failed" };
  if (files.length > MAX_REFERENCE_PHOTO_PAGES) {
    return { ok: false, code: "reference_too_many_photos" };
  }

  const assignment = await getAssignmentForTeacher({
    teacherId: teacher.id,
    assignmentId,
  });
  if (!assignment) return { ok: false, code: "assignment_not_found" };

  let rawText = typeof input?.text === "string" ? input.text : "";
  let storedPath: string | null = null;
  let storedFilename: string | null = null;
  let pages: Array<{ storagePath: string; filename: string }> | null = null;
  let source: "vision" | "extract" | "text" = "text";

  if (kind !== "none" && files.length > 0) {
    try {
      const ingested = await ingestAssignmentReferenceFiles({
        teacherId: teacher.id,
        files,
      });
      rawText = ingested.text;
      storedPath = ingested.storagePath;
      storedFilename = ingested.filename;
      pages = ingested.pages;
      source = ingested.source;
    } catch (error) {
      if (error instanceof UnsupportedHomeworkFormatError) {
        return { ok: false, code: "reference_file_invalid" };
      }
      if (error instanceof EmptyHomeworkTextError) {
        return { ok: false, code: "reference_file_empty" };
      }
      console.error("saveAssignmentReferenceAction ingest failed", error);
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
      storagePath: kind !== "none" ? storedPath : null,
      filename: kind !== "none" && storedPath ? storedFilename : null,
      pages: kind === "none" ? null : pages,
    });
  } catch (error) {
    console.error("saveAssignmentReferenceAction failed", error);
    return { ok: false, code: "reference_failed" };
  }

  revalidatePath(`/grading/assignments/${assignmentId}`);
  revalidatePath("/grading");
  return {
    ok: true,
    text: validated.text,
    pageCount: pages?.length ?? 0,
    source,
  };
}
