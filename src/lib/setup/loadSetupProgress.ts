import type { TeacherRow } from "@/lib/db/types";
import {
  isRubricCriteriaComplete,
  safeParseRubricCriteria,
} from "@/lib/rubrics/criteria";
import {
  getDailyWorkDefaults,
  pickDailyWorkEditorSource,
} from "@/lib/rubrics/defaults";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { evaluateSetup, type SetupEvaluation } from "./progress";

export type SetupProgress = SetupEvaluation & {
  email: string | null;
  displayName: string;
  honorific: string;
  subject: string;
  gradeLabel: string;
};

async function countStudents(teacherId: string): Promise<number> {
  const admin = createAdminSupabaseClient();
  const { count, error } = await admin
    .from("students")
    .select("id", { count: "exact", head: true })
    .eq("teacher_id", teacherId);

  if (error) {
    throw new Error(`Failed to count students: ${error.message}`);
  }

  return count ?? 0;
}

async function dailyRubricIsComplete(teacherId: string): Promise<boolean> {
  const defaults = await getDailyWorkDefaults(teacherId);
  const source = pickDailyWorkEditorSource(defaults);
  if (!source) return false;
  const parsed = safeParseRubricCriteria(source.criteria);
  return parsed.success && isRubricCriteriaComplete(parsed.data);
}

export async function loadSetupProgress(
  teacher: TeacherRow,
): Promise<SetupProgress> {
  const [studentCount, dailyRubricComplete] = await Promise.all([
    countStudents(teacher.id),
    dailyRubricIsComplete(teacher.id),
  ]);

  return {
    ...evaluateSetup({
      displayName: teacher.display_name,
      honorific: teacher.honorific,
      subject: teacher.subject,
      gradeLabel: teacher.grade_label,
      studentCount,
      dailyRubricComplete,
      setupCompletedAt: teacher.setup_completed_at,
    }),
    email: teacher.email,
    displayName: teacher.display_name ?? "",
    honorific: teacher.honorific ?? "",
    subject: teacher.subject ?? "",
    gradeLabel: teacher.grade_label ?? "",
  };
}

export async function saveWelcomeProfile(input: {
  teacherId: string;
  displayName: string;
  honorific: string;
  subject: string;
  gradeLabel: string;
}): Promise<void> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("teachers")
    .update({
      display_name: input.displayName,
      honorific: input.honorific,
      subject: input.subject,
      grade_label: input.gradeLabel,
      updated_at: now,
    })
    .eq("id", input.teacherId);

  if (error) {
    throw new Error(`Failed to save welcome profile: ${error.message}`);
  }
}

export async function markSetupFinished(teacherId: string): Promise<void> {
  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await admin
    .from("teachers")
    .update({ setup_completed_at: now, updated_at: now })
    .eq("id", teacherId)
    .is("setup_completed_at", null);

  if (error) {
    throw new Error(`Failed to finish setup: ${error.message}`);
  }
}
