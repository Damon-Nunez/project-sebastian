import type {
  AssignmentType,
  GradingSessionRow,
} from "@/lib/db/types";
import {
  assignmentFolderLabelsEqual,
  formatAssignmentFolderTitle,
  hasAssignmentFolderPath,
  normalizeAssignmentFolderLabels,
  type AssignmentFolderLabels,
} from "@/lib/grading/labels";
import { findOrCreateAssignment } from "@/lib/grading/assignments";
import { deleteStoredStudentWorkFiles } from "@/lib/grading/upload";
import { normalizeOptionalText } from "@/lib/roster/validate";
import { resolveRubric } from "@/lib/rubrics/resolve";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const SESSION_SELECT =
  "id, teacher_id, section_id, rubric_id, assignment_type, title, module_label, unit_label, lesson_label, assignment_id, status, created_at, updated_at";

export type CreateAssignmentFolderInput = {
  teacherId: string;
  sectionId: string;
  assignmentType: AssignmentType;
  moduleLabel?: string | null;
  unitLabel?: string | null;
  lessonLabel?: string | null;
  /** Optional display name when M/U/L are sparse. */
  title?: string | null;
  /** Required when assignmentType is essay. */
  unitId?: string | null;
};

export type FindOrCreateAssignmentFolderResult = {
  session: GradingSessionRow;
  created: boolean;
};

function asSessionRow(data: Record<string, unknown>): GradingSessionRow {
  return data as GradingSessionRow;
}

export async function listGradingSessionsForPeriod(input: {
  teacherId: string;
  sectionId: string;
}): Promise<GradingSessionRow[]> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("grading_sessions")
    .select(SESSION_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("section_id", input.sectionId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list grading sessions: ${error.message}`);
  }

  return (data ?? []).map((row) => asSessionRow(row as Record<string, unknown>));
}

export async function getGradingSessionForTeacher(input: {
  teacherId: string;
  sessionId: string;
}): Promise<GradingSessionRow | null> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("grading_sessions")
    .select(SESSION_SELECT)
    .eq("teacher_id", input.teacherId)
    .eq("id", input.sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load grading session: ${error.message}`);
  }

  return data ? asSessionRow(data as Record<string, unknown>) : null;
}

async function findExistingAssignmentFolder(input: {
  teacherId: string;
  sectionId: string;
  assignmentType: AssignmentType;
  labels: AssignmentFolderLabels;
}): Promise<GradingSessionRow | null> {
  const sessions = await listGradingSessionsForPeriod({
    teacherId: input.teacherId,
    sectionId: input.sectionId,
  });

  const match = sessions.find(
    (session) =>
      session.assignment_type === input.assignmentType &&
      assignmentFolderLabelsEqual(session, input.labels),
  );

  return match ?? null;
}

async function linkSessionToAssignment(input: {
  teacherId: string;
  sessionId: string;
  assignmentId: string;
}): Promise<GradingSessionRow> {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("grading_sessions")
    .update({ assignment_id: input.assignmentId })
    .eq("teacher_id", input.teacherId)
    .eq("id", input.sessionId)
    .select(SESSION_SELECT)
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to link folder to assignment: ${error?.message ?? "unknown error"}`,
    );
  }
  return asSessionRow(data as Record<string, unknown>);
}

/**
 * Find an existing local assignment folder for this period + type + M/U/L,
 * or create one. Resolves rubric from teacher defaults / section override.
 */
export async function findOrCreateAssignmentFolder(
  input: CreateAssignmentFolderInput,
): Promise<FindOrCreateAssignmentFolderResult> {
  const labels = normalizeAssignmentFolderLabels({
    moduleLabel: input.moduleLabel,
    unitLabel: input.unitLabel,
    lessonLabel: input.lessonLabel,
  });
  const title = normalizeOptionalText(input.title);

  if (!hasAssignmentFolderPath(labels) && !title) {
    throw new Error(
      "Set Module, Unit, or Lesson (or a title) so this assignment has a folder path.",
    );
  }

  const assignment = hasAssignmentFolderPath(labels)
    ? (
        await findOrCreateAssignment({
          teacherId: input.teacherId,
          assignmentType: input.assignmentType,
          labels,
          unitId: input.unitId,
        })
      ).assignment
    : null;

  const existing = await findExistingAssignmentFolder({
    teacherId: input.teacherId,
    sectionId: input.sectionId,
    assignmentType: input.assignmentType,
    labels,
  });

  if (existing) {
    if (assignment && existing.assignment_id !== assignment.id) {
      return {
        session: await linkSessionToAssignment({
          teacherId: input.teacherId,
          sessionId: existing.id,
          assignmentId: assignment.id,
        }),
        created: false,
      };
    }
    return { session: existing, created: false };
  }

  const resolved = await resolveRubric({
    teacherId: input.teacherId,
    kind: input.assignmentType,
    sectionId: input.sectionId,
    unitId: input.unitId,
  });

  if (!resolved) {
    throw new Error(
      input.assignmentType === "essay"
        ? "No essay rubric found for that unit. Set one up under Rubrics first."
        : "No daily-work rubric found. Set one up under Rubrics → Daily work first.",
    );
  }

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const folderTitle = formatAssignmentFolderTitle(
    labels,
    title,
    input.assignmentType,
  );

  const { data, error } = await admin
    .from("grading_sessions")
    .insert({
      teacher_id: input.teacherId,
      section_id: input.sectionId,
      rubric_id: resolved.rubric.id,
      assignment_type: input.assignmentType,
      title: folderTitle,
      module_label: labels.module_label,
      unit_label: labels.unit_label,
      lesson_label: labels.lesson_label,
      assignment_id: assignment?.id ?? null,
      status: "draft",
      updated_at: now,
    })
    .select(SESSION_SELECT)
    .single();

  if (error) {
    // Race: unique index hit — re-fetch.
    if (error.code === "23505") {
      const raced = await findExistingAssignmentFolder({
        teacherId: input.teacherId,
        sectionId: input.sectionId,
        assignmentType: input.assignmentType,
        labels,
      });
      if (raced) return { session: raced, created: false };
    }
    throw new Error(`Failed to create assignment folder: ${error.message}`);
  }

  return {
    session: asSessionRow(data as Record<string, unknown>),
    created: true,
  };
}

/**
 * Delete an assignment folder owned by the teacher, plus student_work
 * documents filed in it. Suggestions cascade via FK.
 */
export async function deleteGradingSessionForTeacher(input: {
  teacherId: string;
  sessionId: string;
}): Promise<{ periodId: string }> {
  const existing = await getGradingSessionForTeacher({
    teacherId: input.teacherId,
    sessionId: input.sessionId,
  });
  if (!existing) {
    throw new Error("Assignment folder not found");
  }

  const admin = createAdminSupabaseClient();

  const { data: deletedDocs, error: docsError } = await admin
    .from("documents")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("grading_session_id", input.sessionId)
    .eq("kind", "student_work")
    .select("storage_path, vision_pages");

  if (docsError) {
    throw new Error(`Failed to delete homework in folder: ${docsError.message}`);
  }

  await deleteStoredStudentWorkFiles(deletedDocs ?? []);

  const { data, error } = await admin
    .from("grading_sessions")
    .delete()
    .eq("teacher_id", input.teacherId)
    .eq("id", input.sessionId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to delete assignment folder: ${error.message}`);
  }
  if (!data) {
    throw new Error("Assignment folder not found");
  }

  return { periodId: existing.section_id };
}

export function sessionFolderTitle(session: GradingSessionRow): string {
  return formatAssignmentFolderTitle(
    {
      module_label: session.module_label,
      unit_label: session.unit_label,
      lesson_label: session.lesson_label,
    },
    session.title,
    session.assignment_type,
  );
}
