import type { AssignmentRow } from "@/lib/db/types";
import { listFiledStudentIdsForAssignment } from "@/lib/grading/assignments";
import {
  orderPagesForCombine,
  sortUnfiledWork,
  type SortedWork,
} from "@/lib/grading/batchSort";
import {
  MAX_VISION_PAGES,
  parseVisionPages,
  studentWorkStoragePaths,
  type VisionPage,
} from "@/lib/grading/studentWorkFiles";
import {
  deleteStoredStudentWorkFiles,
  listUnfiledStudentWorkForAssignment,
} from "@/lib/grading/upload";
import { remaskVisionPage } from "@/lib/grading/vision";
import {
  listPeriodsWithRostersForTeacher,
  type PeriodWithRoster,
} from "@/lib/roster/periods";
import { listStudentsForTeacher } from "@/lib/roster/students";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type AssignmentBatch = {
  periods: PeriodWithRoster[];
  sorted: SortedWork[];
};

/** Unfiled uploads for an assignment, sorted into Ready / Unsorted. */
export async function loadAssignmentBatch(input: {
  teacherId: string;
  assignment: AssignmentRow;
}): Promise<AssignmentBatch> {
  const [documents, periods, filedStudentIds] = await Promise.all([
    listUnfiledStudentWorkForAssignment({
      teacherId: input.teacherId,
      assignmentId: input.assignment.id,
    }),
    listPeriodsWithRostersForTeacher(input.teacherId),
    listFiledStudentIdsForAssignment({
      teacherId: input.teacherId,
      assignmentId: input.assignment.id,
    }),
  ]);

  return {
    periods,
    sorted: sortUnfiledWork({
      assignment: input.assignment,
      documents,
      periods,
      filedStudentIds,
    }),
  };
}

export class CombinePagesError extends Error {
  constructor(readonly code: "combine_too_few" | "combine_too_many") {
    super(code);
    this.name = "CombinePagesError";
  }
}

/**
 * Merge unfiled photos / scans into one paper (pages in file-name order).
 * The first keeps its row; the others' pages move onto it and their rows go.
 * Pages are re-masked for their new position before anything is saved.
 */
export async function combineUnfiledPages(input: {
  teacherId: string;
  assignmentId: string;
  documentIds: string[];
}): Promise<void> {
  const requested = new Set(input.documentIds);
  const unfiled = await listUnfiledStudentWorkForAssignment({
    teacherId: input.teacherId,
    assignmentId: input.assignmentId,
  });
  const picked = orderPagesForCombine(
    unfiled.filter(
      (doc) =>
        requested.has(doc.id) &&
        doc.needs_vision &&
        parseVisionPages(doc.vision_pages).length > 0,
    ),
  );
  if (picked.length < 2) {
    throw new CombinePagesError("combine_too_few");
  }
  const pages = picked.flatMap((doc) => parseVisionPages(doc.vision_pages));
  if (pages.length > MAX_VISION_PAGES) {
    throw new CombinePagesError("combine_too_many");
  }

  const roster = await listStudentsForTeacher(input.teacherId);
  const combined: VisionPage[] = [];
  for (const [pageIndex, page] of pages.entries()) {
    combined.push(await remaskVisionPage({ page, pageIndex, roster }));
  }

  const [primary, ...rest] = picked;
  const admin = createAdminSupabaseClient();
  await admin
    .from("documents")
    .update({
      vision_pages: combined,
      body_text:
        picked
          .map((doc) => doc.body_text?.trim())
          .filter(Boolean)
          .join("\n\n") || null,
      updated_at: new Date().toISOString(),
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", primary!.id)
    .is("grading_session_id", null)
    .throwOnError();
  await admin
    .from("documents")
    .delete()
    .eq("teacher_id", input.teacherId)
    .in(
      "id",
      rest.map((doc) => doc.id),
    )
    .is("grading_session_id", null)
    .throwOnError();

  const kept = new Set(
    studentWorkStoragePaths({ storage_path: primary!.storage_path, vision_pages: combined }),
  );
  await deleteStoredStudentWorkFiles(
    picked
      .flatMap(studentWorkStoragePaths)
      .filter((path) => !kept.has(path))
      .map((path) => ({ storage_path: path })),
  );
}
