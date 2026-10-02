/**
 * Teacher-level assignments (Ticket 10 / SCRUM-128): one row per
 * teacher + type + M/U/L owning the shared reference for every period folder.
 */
import type {
  AssignmentRow,
  AssignmentType,
  GradingSessionRow,
  ReferenceKind,
} from "@/lib/db/types";
import {
  hasAssignmentFolderPath,
  normalizeFolderLabel,
  type AssignmentFolderLabels,
} from "@/lib/grading/labels";
import { deleteStoredStudentWorkFiles } from "@/lib/grading/upload";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const ASSIGNMENT_SELECT =
  "id, teacher_id, assignment_type, title, module_label, unit_label, lesson_label, unit_id, reference_kind, reference_text, reference_filename, reference_storage_path, reference_updated_at, created_at, updated_at";

export type AssignmentPeriodFolder = {
  session: Pick<GradingSessionRow, "id" | "section_id" | "status" | "updated_at">;
  periodName: string;
  documentCount: number;
};

async function findAssignmentByPath(input: {
  teacherId: string;
  assignmentType: AssignmentType;
  labels: AssignmentFolderLabels;
}): Promise<AssignmentRow | null> {
  const admin = createAdminSupabaseClient();
  let query = admin
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("assignment_type", input.assignmentType);

  for (const column of ["module_label", "unit_label", "lesson_label"] as const) {
    const value = input.labels[column];
    query = value === null ? query.is(column, null) : query.eq(column, value);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(`Failed to look up assignment: ${error.message}`);
  }
  return (data as AssignmentRow | null) ?? null;
}

/** Find the assignment for this type + M/U/L, or create it (no reference yet). */
export async function findOrCreateAssignment(input: {
  teacherId: string;
  assignmentType: AssignmentType;
  labels: AssignmentFolderLabels;
  unitId?: string | null;
  title?: string | null;
}): Promise<{ assignment: AssignmentRow; created: boolean }> {
  if (!hasAssignmentFolderPath(input.labels)) {
    throw new Error("Set Module, Unit, or Lesson so this assignment has a folder path.");
  }

  const existing = await findAssignmentByPath(input);
  if (existing) return { assignment: existing, created: false };

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("assignments")
    .insert({
      teacher_id: input.teacherId,
      assignment_type: input.assignmentType,
      title: normalizeFolderLabel(input.title),
      module_label: input.labels.module_label,
      unit_label: input.labels.unit_label,
      lesson_label: input.labels.lesson_label,
      unit_id: input.unitId ?? null,
      reference_kind: "none",
      updated_at: new Date().toISOString(),
    })
    .select(ASSIGNMENT_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      const raced = await findAssignmentByPath(input);
      if (raced) return { assignment: raced, created: false };
    }
    throw new Error(`Failed to create assignment: ${error.message}`);
  }

  return { assignment: data as AssignmentRow, created: true };
}

export async function getAssignmentForTeacher(input: {
  teacherId: string;
  assignmentId: string;
}): Promise<AssignmentRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("id", input.assignmentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load assignment: ${error.message}`);
  }
  return (data as AssignmentRow | null) ?? null;
}

export async function listAssignmentsForTeacher(
  teacherId: string,
): Promise<AssignmentRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("teacher_id", teacherId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list assignments: ${error.message}`);
  }
  return (data ?? []) as AssignmentRow[];
}

/**
 * Replace the assignment's reference. Text is already validated; a replaced
 * or cleared reference file is removed from Storage.
 */
export async function setAssignmentReference(input: {
  teacherId: string;
  assignmentId: string;
  kind: ReferenceKind;
  text: string | null;
  filename?: string | null;
  storagePath?: string | null;
}): Promise<AssignmentRow> {
  const existing = await getAssignmentForTeacher(input);
  if (!existing) {
    throw new Error("Assignment not found");
  }

  const clearing = input.kind === "none";
  const nextPath = clearing
    ? null
    : (input.storagePath ?? existing.reference_storage_path);
  const nextFilename = clearing
    ? null
    : input.storagePath
      ? (input.filename ?? null)
      : existing.reference_filename;

  const now = new Date().toISOString();
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("assignments")
    .update({
      reference_kind: input.kind,
      reference_text: input.text,
      reference_filename: nextFilename,
      reference_storage_path: nextPath,
      reference_updated_at: now,
      updated_at: now,
    })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.assignmentId)
    .select(ASSIGNMENT_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to save assignment reference: ${error?.message ?? "unknown error"}`,
    );
  }

  if (
    existing.reference_storage_path &&
    existing.reference_storage_path !== nextPath
  ) {
    await deleteStoredStudentWorkFiles([
      { storage_path: existing.reference_storage_path },
    ]);
  }

  return data as AssignmentRow;
}

/** Students who already have a paper filed in any period folder of this assignment. */
export async function listFiledStudentIdsForAssignment(input: {
  teacherId: string;
  assignmentId: string;
}): Promise<Set<string>> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("documents")
    .select("student_id, grading_sessions!inner(assignment_id)")
    .eq("teacher_id", input.teacherId)
    .eq("kind", "student_work")
    .eq("grading_sessions.assignment_id", input.assignmentId)
    .not("student_id", "is", null);

  if (error) {
    throw new Error(`Failed to list filed students: ${error.message}`);
  }
  return new Set((data ?? []).map((row) => row.student_id as string));
}

/** Period folders filed under this assignment, with how many papers each holds. */
export async function listPeriodFoldersForAssignment(input: {
  teacherId: string;
  assignmentId: string;
}): Promise<AssignmentPeriodFolder[]> {
  const admin = createAdminSupabaseClient();
  const { data: sessions, error } = await admin
    .from("grading_sessions")
    .select("id, section_id, status, updated_at, sections(name)")
    .eq("teacher_id", input.teacherId)
    .eq("assignment_id", input.assignmentId);

  if (error) {
    throw new Error(`Failed to list period folders: ${error.message}`);
  }
  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id as string);
  const { data: docs, error: docsError } = await admin
    .from("documents")
    .select("grading_session_id")
    .eq("teacher_id", input.teacherId)
    .eq("kind", "student_work")
    .in("grading_session_id", sessionIds);

  if (docsError) {
    throw new Error(`Failed to count folder papers: ${docsError.message}`);
  }

  const counts = new Map<string, number>();
  for (const doc of docs ?? []) {
    const id = doc.grading_session_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return sessions
    .map((s) => {
      const section = s.sections as { name?: string } | { name?: string }[] | null;
      const periodName =
        (Array.isArray(section) ? section[0]?.name : section?.name) ?? "Period";
      return {
        session: {
          id: s.id as string,
          section_id: s.section_id as string,
          status: s.status as GradingSessionRow["status"],
          updated_at: s.updated_at as string,
        },
        periodName,
        documentCount: counts.get(s.id as string) ?? 0,
      };
    })
    .sort((a, b) => a.periodName.localeCompare(b.periodName, undefined, { numeric: true }));
}
